// @vitest-environment node
// M15-S21: Audio-Soundboard Export/Import — Service/Roundtrip (#311)
// See: https://github.com/Djimon/WorldBrain/issues/311
//
// Design entschieden (Interview 2026-07-22):
// D-A lokale Dateien = nur Referenz + Re-Link beim Import (kein Bündeln).
// D-B Kollision beim Import = additiv, "Name (2)"/(3).../, kein Merge.
// D-C schema_version im Export-Root, unbekannte Version -> Fehler.
//
// AP-001: DatabaseLike, kein unknown-Cast am Call-Site.
// AP-006: kein try/catch um DB-Operationen — Ausnahme ist JSON-Validierung
// (kein DB-Call, reiner Eingabe-Guard).

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyAudioSchema } from '../core_data/audio-schema';
import type { DatabaseLike } from '../src/services/entity-service';
import {
  createChannel, createPreset, createScene, listChannels, listPresets, listScenes, updateChannelMixer,
} from '../src/services/audio-service';
import {
  AUDIO_EXPORT_SCHEMA_VERSION, exportScenesToJson, importAudioBoardFromJson,
} from '../src/services/audio-export-import-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyAudioSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function seedFullScene(asyncDb: DatabaseLike, sceneName: string) {
  const { id: sceneId } = await createScene(asyncDb, { name: sceneName });
  const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId, name: 'Ambience' });
  await updateChannelMixer(asyncDb, channelId, {
    volume: 0.7, balance: -0.2, eq_low: 3, eq_mid: -1, eq_high: 2,
    mode: 'add', transition_type: 'fade', transition_seconds: 2.5, muted: false,
  });
  await createPreset(asyncDb, {
    channel_id: channelId, source_type: 'file', source_ref: '/proj/assets/audio/rain.mp3',
    base_volume: 0.8, label: 'Rain', icon: '🌧️', color: '#1d5f7b', loop: true,
  });
  return { sceneId, channelId };
}

describe('#311 (service): exportScenesToJson', () => {
  it('writes schema_version 1 at the export root (AC 2, D-C)', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId } = await seedFullScene(asyncDb, 'Tavern');
      const out = await exportScenesToJson(asyncDb, [sceneId]);
      expect(out.schema_version).toBe(AUDIO_EXPORT_SCHEMA_VERSION);
      expect(AUDIO_EXPORT_SCHEMA_VERSION).toBe(1);
    } finally { db.close(); }
  });

  it('exports the scene name and order_index, but no id/created_at', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId } = await seedFullScene(asyncDb, 'Tavern');
      const out = await exportScenesToJson(asyncDb, [sceneId]);
      expect(out.scenes).toHaveLength(1);
      const scene = out.scenes[0];
      expect(scene.name).toBe('Tavern');
      expect(scene.order_index).toBe(0);
      expect(scene).not.toHaveProperty('id');
      expect(scene).not.toHaveProperty('created_at');
    } finally { db.close(); }
  });

  it('exports the full channel mixer state, no id/scene_id', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId } = await seedFullScene(asyncDb, 'Tavern');
      const out = await exportScenesToJson(asyncDb, [sceneId]);
      const channel = out.scenes[0].channels[0];
      expect(channel).toMatchObject({
        name: 'Ambience', mode: 'add', volume: 0.7, balance: -0.2,
        eq_low: 3, eq_mid: -1, eq_high: 2, muted: false,
        transition_type: 'fade', transition_seconds: 2.5,
      });
      expect(channel).not.toHaveProperty('id');
      expect(channel).not.toHaveProperty('scene_id');
    } finally { db.close(); }
  });

  it('exports full clip data, no id/channel_id/created_at', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId } = await seedFullScene(asyncDb, 'Tavern');
      const out = await exportScenesToJson(asyncDb, [sceneId]);
      const clip = out.scenes[0].channels[0].clips[0];
      expect(clip).toMatchObject({
        source_type: 'file', source_ref: '/proj/assets/audio/rain.mp3',
        base_volume: 0.8, label: 'Rain', icon: '🌧️', color: '#1d5f7b', loop: true,
      });
      expect(clip).not.toHaveProperty('id');
      expect(clip).not.toHaveProperty('channel_id');
      expect(clip).not.toHaveProperty('created_at');
    } finally { db.close(); }
  });

  it('only exports the selected scene ids, not the whole board', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId: keep } = await seedFullScene(asyncDb, 'Tavern');
      await seedFullScene(asyncDb, 'Dungeon');
      const out = await exportScenesToJson(asyncDb, [keep]);
      expect(out.scenes.map((s) => s.name)).toEqual(['Tavern']);
    } finally { db.close(); }
  });
});

describe('#311 (service): importAudioBoardFromJson — roundtrip (AC 3/5)', () => {
  it('roundtrip: export then import recreates an equivalent scene with fresh ids', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId: originalId } = await seedFullScene(asyncDb, 'Tavern');
      const exported = await exportScenesToJson(asyncDb, [originalId]);
      const result = await importAudioBoardFromJson(asyncDb, exported);
      expect(result.importedSceneIds).toHaveLength(1);
      expect(result.importedSceneIds[0]).not.toBe(originalId);

      const scenes = await listScenes(asyncDb);
      const imported = scenes.find((s) => s.id === result.importedSceneIds[0]);
      // D-B: the original 'Tavern' scene is still in the DB (never deleted
      // by export/import), so the re-imported copy collides and gets " (2)"
      // appended — additive, same as the dedicated D-B test below.
      expect(imported?.name).toBe('Tavern (2)');

      const channels = await listChannels(asyncDb, imported!.id);
      expect(channels).toHaveLength(1);
      expect(channels[0]).toMatchObject({ name: 'Ambience', volume: 0.7, mode: 'add' });

      const clips = await listPresets(asyncDb, channels[0].id);
      expect(clips).toHaveLength(1);
      expect(clips[0]).toMatchObject({ label: 'Rain', source_ref: '/proj/assets/audio/rain.mp3' });
    } finally { db.close(); }
  });

  it('D-B: importing a scene whose name collides appends " (2)", original scene stays unchanged', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId: originalId } = await seedFullScene(asyncDb, 'Tavern');
      const exported = await exportScenesToJson(asyncDb, [originalId]);
      await importAudioBoardFromJson(asyncDb, exported);

      const scenes = await listScenes(asyncDb);
      expect(scenes).toHaveLength(2);
      const names = scenes.map((s) => s.name).sort();
      expect(names).toEqual(['Tavern', 'Tavern (2)']);
      // original scene's own row is untouched, not merged/overwritten
      expect(scenes.find((s) => s.id === originalId)?.name).toBe('Tavern');
    } finally { db.close(); }
  });

  it('D-B: a second re-import of the same export appends " (3)"', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId: originalId } = await seedFullScene(asyncDb, 'Tavern');
      const exported = await exportScenesToJson(asyncDb, [originalId]);
      await importAudioBoardFromJson(asyncDb, exported);
      await importAudioBoardFromJson(asyncDb, exported);

      const scenes = await listScenes(asyncDb);
      expect(scenes.map((s) => s.name).sort()).toEqual(['Tavern', 'Tavern (2)', 'Tavern (3)']);
    } finally { db.close(); }
  });

  it('D-A: a file-type clip keeps its source_ref reference and is reported as unlinked', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const { sceneId } = await seedFullScene(asyncDb, 'Tavern');
      const exported = await exportScenesToJson(asyncDb, [sceneId]);
      const result = await importAudioBoardFromJson(asyncDb, exported);

      expect(result.unlinkedFiles).toContainEqual(
        expect.objectContaining({ clipLabel: 'Rain', sourceRef: '/proj/assets/audio/rain.mp3' }),
      );

      const imported = (await listScenes(asyncDb)).find((s) => s.id === result.importedSceneIds[0]);
      const channels = await listChannels(asyncDb, imported!.id);
      const clips = await listPresets(asyncDb, channels[0].id);
      expect(clips[0].source_ref).toBe('/proj/assets/audio/rain.mp3');
    } finally { db.close(); }
  });
});

describe('#311 (service): importAudioBoardFromJson — invalid input (AC 7)', () => {
  it('rejects a payload with no schema_version', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      await expect(importAudioBoardFromJson(asyncDb, { scenes: [] })).rejects.toThrow();
      expect(await listScenes(asyncDb)).toHaveLength(0);
    } finally { db.close(); }
  });

  it('rejects a payload with an unknown schema_version', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      await expect(importAudioBoardFromJson(asyncDb, { schema_version: 999, scenes: [] })).rejects.toThrow();
      expect(await listScenes(asyncDb)).toHaveLength(0);
    } finally { db.close(); }
  });

  it('rejects a payload where scenes is not an array', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      await expect(importAudioBoardFromJson(asyncDb, { schema_version: 1, scenes: 'nope' })).rejects.toThrow();
      expect(await listScenes(asyncDb)).toHaveLength(0);
    } finally { db.close(); }
  });

  it('rejects a non-object payload (e.g. a plain string or array)', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      await expect(importAudioBoardFromJson(asyncDb, 'not json')).rejects.toThrow();
      await expect(importAudioBoardFromJson(asyncDb, [1, 2, 3])).rejects.toThrow();
      expect(await listScenes(asyncDb)).toHaveLength(0);
    } finally { db.close(); }
  });
});
