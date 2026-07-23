// @vitest-environment node
// M15-S11: Audio-Datenmodell & Service (Scenes/Channels/Presets)
// See: https://github.com/Djimon/WorldBrain/issues/282
//
// Note: pure DatabaseLike service module (no UI in this file) — AP-001 is
// satisfied structurally (every function takes DatabaseLike); not
// separately re-tested to avoid fabricating a non-existent requirement.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyAudioSchema } from '../core_data/audio-schema';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyAudioSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function getAudioService() { return import('../src/services/audio-service'); }

describe('M15-S11 audio data model & service', () => {
  describe('table shape', () => {
    it('audio_scenes has id, name, order_index, created_at', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(audio_scenes)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual(['created_at', 'id', 'name', 'order_index'].sort());
      } finally {
        db.close();
      }
    });

    it('audio_channels has all mixer columns', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(audio_channels)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual([
          'balance', 'eq_high', 'eq_low', 'eq_mid', 'id', 'mode', 'muted', 'name',
          'order_index', 'scene_id', 'transition_seconds', 'transition_type', 'volume',
        ].sort());
      } finally {
        db.close();
      }
    });

    it('audio_presets has source + style columns', () => {
      const { db } = createDatabase();
      try {
        const cols = (db.prepare('PRAGMA table_info(audio_presets)').all() as Array<{ name: string }>).map((c) => c.name);
        expect(cols.sort()).toEqual([
          'base_volume', 'channel_id', 'color', 'created_at', 'icon', 'id',
          'label', 'loop', 'order_index', 'source_ref', 'source_type',
        ].sort());
      } finally {
        db.close();
      }
    });
  });

  describe('scene CRUD + reorder', () => {
    it('creates a scene with a scene_-prefixed id and contiguous order_index', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, listScenes } = await getAudioService();
      try {
        const { id: a } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: b } = await createScene(asyncDb, { name: 'Dungeon' });
        expect(a).toMatch(/^scene_/);
        const scenes = await listScenes(asyncDb);
        expect(scenes.map((s) => s.order_index)).toEqual([0, 1]);
        expect(scenes.map((s) => s.id)).toEqual([a, b]);
      } finally {
        db.close();
      }
    });

    it('renames a scene', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, renameScene, listScenes } = await getAudioService();
      try {
        const { id } = await createScene(asyncDb, { name: 'Old' });
        await renameScene(asyncDb, id, 'New');
        expect((await listScenes(asyncDb)).find((s) => s.id === id)?.name).toBe('New');
      } finally {
        db.close();
      }
    });

    it('reorders scenes to a contiguous new order_index', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, reorderScenes, listScenes } = await getAudioService();
      try {
        const { id: a } = await createScene(asyncDb, { name: 'A' });
        const { id: b } = await createScene(asyncDb, { name: 'B' });
        await reorderScenes(asyncDb, [b, a]);
        const scenes = await listScenes(asyncDb);
        expect(scenes.map((s) => s.id)).toEqual([b, a]);
        expect(scenes.map((s) => s.order_index)).toEqual([0, 1]);
      } finally {
        db.close();
      }
    });

    it('deleting a scene cascades to its channels and their presets', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, deleteScene, listScenes, listChannels, listPresets } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'rain.mp3' });
        await deleteScene(asyncDb, sceneId);
        expect((await listScenes(asyncDb)).find((s) => s.id === sceneId)).toBeUndefined();
        expect(await listChannels(asyncDb, sceneId)).toEqual([]);
        expect(await listPresets(asyncDb, channelId)).toEqual([]);
      } finally {
        db.close();
      }
    });

    it('duplicateScene copies channels and presets into a new scene', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, updateChannelMixer, duplicateScene, listScene } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId, name: 'Music' });
        await updateChannelMixer(asyncDb, channelId, { volume: 0.5 });
        await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'lute.mp3', label: 'Lute' });

        const { id: copyId } = await duplicateScene(asyncDb, sceneId, 'Tavern Copy');
        const copy = await listScene(asyncDb, copyId);

        expect(copy?.name).toBe('Tavern Copy');
        expect(copy?.channels).toHaveLength(1);
        expect(copy?.channels[0].id).not.toBe(channelId);
        expect(copy?.channels[0].volume).toBe(0.5);
        expect(copy?.channels[0].presets).toHaveLength(1);
        expect(copy?.channels[0].presets[0].label).toBe('Lute');
      } finally {
        db.close();
      }
    });
  });

  describe('channel CRUD + reorder', () => {
    it('creates a channel with a chan_-prefixed id, defaults intact', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId, name: 'Music' });
        expect(channelId).toMatch(/^chan_/);
        const channel = (await listChannels(asyncDb, sceneId))[0];
        expect(channel.mode).toBe('replace');
        expect(channel.volume).toBe(1);
        expect(channel.transition_type).toBe('fade');
      } finally {
        db.close();
      }
    });

    it('reorders channels within a scene', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, reorderChannels, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: a } = await createChannel(asyncDb, { scene_id: sceneId, name: 'A' });
        const { id: b } = await createChannel(asyncDb, { scene_id: sceneId, name: 'B' });
        await reorderChannels(asyncDb, [b, a]);
        expect((await listChannels(asyncDb, sceneId)).map((c) => c.id)).toEqual([b, a]);
      } finally {
        db.close();
      }
    });

    it('deleting a channel cascades to its presets', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, deleteChannel, listPresets, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'a.mp3' });
        await deleteChannel(asyncDb, channelId);
        expect(await listPresets(asyncDb, channelId)).toEqual([]);
        expect(await listChannels(asyncDb, sceneId)).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('updateChannelMixer clamps', () => {
    it('clamps volume to 0..1', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, updateChannelMixer, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await updateChannelMixer(asyncDb, channelId, { volume: 5 });
        expect((await listChannels(asyncDb, sceneId))[0].volume).toBe(1);
        await updateChannelMixer(asyncDb, channelId, { volume: -5 });
        expect((await listChannels(asyncDb, sceneId))[0].volume).toBe(0);
      } finally {
        db.close();
      }
    });

    it('clamps balance to -1..1', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, updateChannelMixer, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await updateChannelMixer(asyncDb, channelId, { balance: 3 });
        expect((await listChannels(asyncDb, sceneId))[0].balance).toBe(1);
        await updateChannelMixer(asyncDb, channelId, { balance: -3 });
        expect((await listChannels(asyncDb, sceneId))[0].balance).toBe(-1);
      } finally {
        db.close();
      }
    });

    it('clamps eq_low/eq_mid/eq_high to ±12 dB', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, updateChannelMixer, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await updateChannelMixer(asyncDb, channelId, { eq_low: 20, eq_mid: -20, eq_high: 999 });
        const channel = (await listChannels(asyncDb, sceneId))[0];
        expect(channel.eq_low).toBe(12);
        expect(channel.eq_mid).toBe(-12);
        expect(channel.eq_high).toBe(12);
      } finally {
        db.close();
      }
    });

    it('rejects an invalid mode', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, updateChannelMixer } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await expect(updateChannelMixer(asyncDb, channelId, { mode: 'shuffle' as unknown as 'replace' })).rejects.toThrow();
      } finally {
        db.close();
      }
    });

    it('accepts mode/transition_type/muted updates', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, updateChannelMixer, listChannels } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await updateChannelMixer(asyncDb, channelId, { mode: 'add', transition_type: 'cut', muted: true });
        const channel = (await listChannels(asyncDb, sceneId))[0];
        expect(channel.mode).toBe('add');
        expect(channel.transition_type).toBe('cut');
        expect(channel.muted).toBe(1);
      } finally {
        db.close();
      }
    });
  });

  describe('preset CRUD + clamps + enum validation', () => {
    it('creates a preset with a clip_-prefixed id', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, listPresets } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        const { id: presetId } = await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'rain.mp3', label: 'Rain' });
        expect(presetId).toMatch(/^clip_/);
        expect((await listPresets(asyncDb, channelId))[0].label).toBe('Rain');
      } finally {
        db.close();
      }
    });

    it('rejects an invalid source_type on create', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        await expect(createPreset(asyncDb, { channel_id: channelId, source_type: 'soundcloud' as unknown as 'file', source_ref: 'x' })).rejects.toThrow();
      } finally {
        db.close();
      }
    });

    it('clamps base_volume to 0..1 on create and update', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, updatePreset, listPresets } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        const { id: presetId } = await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'a.mp3', base_volume: 5 });
        expect((await listPresets(asyncDb, channelId))[0].base_volume).toBe(1);
        await updatePreset(asyncDb, presetId, { base_volume: -5 });
        expect((await listPresets(asyncDb, channelId))[0].base_volume).toBe(0);
      } finally {
        db.close();
      }
    });

    it('reorders presets within a channel', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, reorderPresets, listPresets } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        const { id: a } = await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'a.mp3' });
        const { id: b } = await createPreset(asyncDb, { channel_id: channelId, source_type: 'file', source_ref: 'b.mp3' });
        await reorderPresets(asyncDb, [b, a]);
        expect((await listPresets(asyncDb, channelId)).map((p) => p.id)).toEqual([b, a]);
      } finally {
        db.close();
      }
    });

    it('deletes a preset', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, deletePreset, listPresets } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'S' });
        const { id: channelId } = await createChannel(asyncDb, { scene_id: sceneId });
        const { id: presetId } = await createPreset(asyncDb, { channel_id: channelId, source_type: 'link', source_ref: 'https://youtube.com/watch?v=x' });
        await deletePreset(asyncDb, presetId);
        expect(await listPresets(asyncDb, channelId)).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('listScene: nested one-shot board load', () => {
    it('returns the scene with ordered channels, each with ordered presets', async () => {
      const { db, asyncDb } = createDatabase();
      const { createScene, createChannel, createPreset, listScene } = await getAudioService();
      try {
        const { id: sceneId } = await createScene(asyncDb, { name: 'Tavern' });
        const { id: musicId } = await createChannel(asyncDb, { scene_id: sceneId, name: 'Music' });
        const { id: ambienceId } = await createChannel(asyncDb, { scene_id: sceneId, name: 'Ambience' });
        await createPreset(asyncDb, { channel_id: musicId, source_type: 'file', source_ref: 'a.mp3', label: 'A' });
        await createPreset(asyncDb, { channel_id: musicId, source_type: 'file', source_ref: 'b.mp3', label: 'B' });

        const scene = await listScene(asyncDb, sceneId);
        expect(scene?.channels.map((c) => c.id)).toEqual([musicId, ambienceId]);
        expect(scene?.channels[0].presets.map((p) => p.label)).toEqual(['A', 'B']);
        expect(scene?.channels[1].presets).toEqual([]);
      } finally {
        db.close();
      }
    });

    it('returns null for an unknown scene id', async () => {
      const { db, asyncDb } = createDatabase();
      const { listScene } = await getAudioService();
      try {
        expect(await listScene(asyncDb, 'scene_does-not-exist')).toBeNull();
      } finally {
        db.close();
      }
    });
  });
});
