// M15-S21 (#311): Audio-Soundboard Export/Import — komplette Board-
// Konfiguration (Szenen/Kanäle/Clips) als JSON teilbar.
//
// Design entschieden (Interview 2026-07-22):
// D-A Lokale Dateien = nur Referenz, Re-Link beim Import. Kein Datei-Bündeln.
// D-B Kollision beim Import = immer additiv ("Name (2)", "Name (3)", ...).
//     Kein Merge, kein Überschreiben.
// D-C Schema-Version im Export-Root (schema_version), unbekannte Version
//     beim Import -> klare Fehlermeldung (gerenderte UI, kein Browser-Dialog).
import type { DatabaseLike } from './entity-service';
import {
  createChannel, createPreset, createScene, listChannels, listPresets, listScenes, updateChannelMixer,
} from './audio-service';
import type { ChannelMode, SourceType, TransitionType } from './audio-service';

export const AUDIO_EXPORT_SCHEMA_VERSION = 1;

// Reine Referenz auf Datenmodell-Felder aus audio-service.ts — keine ids,
// kein created_at (neue ids werden beim Import vergeben).
export interface AudioExportClip {
  order_index: number;
  source_type: SourceType;
  source_ref: string;
  base_volume: number;
  label: string | null;
  icon: string | null;
  color: string | null;
  loop: boolean;
}

export interface AudioExportChannel {
  name: string | null;
  order_index: number;
  mode: ChannelMode;
  volume: number;
  balance: number;
  eq_low: number;
  eq_mid: number;
  eq_high: number;
  muted: boolean;
  transition_type: TransitionType;
  transition_seconds: number;
  clips: AudioExportClip[];
}

export interface AudioExportScene {
  name: string;
  order_index: number;
  channels: AudioExportChannel[];
}

export interface AudioExportFile {
  schema_version: number;
  scenes: AudioExportScene[];
}

// AC 2: liest die ausgewählten Szenen vollständig (listScene je Szene) und
// baut die exportierbare, id-freie Repräsentation.
export async function exportScenesToJson(db: DatabaseLike, sceneIds: string[]): Promise<AudioExportFile> {
  const wanted = new Set(sceneIds);
  const allScenes = await listScenes(db);
  const scenes: AudioExportScene[] = [];
  for (const scene of allScenes) {
    if (!wanted.has(scene.id)) continue;
    const channels = await listChannels(db, scene.id);
    const exportedChannels: AudioExportChannel[] = [];
    for (const channel of channels) {
      const presets = await listPresets(db, channel.id);
      exportedChannels.push({
        name: channel.name,
        order_index: channel.order_index,
        mode: channel.mode,
        volume: channel.volume,
        balance: channel.balance,
        eq_low: channel.eq_low,
        eq_mid: channel.eq_mid,
        eq_high: channel.eq_high,
        muted: !!channel.muted,
        transition_type: channel.transition_type,
        transition_seconds: channel.transition_seconds,
        clips: presets.map((preset) => ({
          order_index: preset.order_index,
          source_type: preset.source_type,
          source_ref: preset.source_ref,
          base_volume: preset.base_volume,
          label: preset.label,
          icon: preset.icon,
          color: preset.color,
          loop: !!preset.loop,
        })),
      });
    }
    scenes.push({ name: scene.name, order_index: scene.order_index, channels: exportedChannels });
  }
  return { schema_version: AUDIO_EXPORT_SCHEMA_VERSION, scenes };
}

export interface AudioImportUnlinkedFile {
  clipLabel: string | null;
  sourceRef: string;
}

export interface AudioImportResult {
  importedSceneIds: string[];
  unlinkedFiles: AudioImportUnlinkedFile[];
}

// Geworfen bei kaputtem/fremdem JSON (kein Objekt, unbekannte
// schema_version, `scenes` fehlt/kein Array) — AC 7 verlangt eine klare,
// gerenderte Fehlermeldung statt eines Browser-Dialogs; dieser Fehlertyp
// ist der Kontrakt, den die UI-Schicht abfängt und rendert.
export class InvalidAudioExportError extends Error {}

function uniqueSceneName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  let n = 2;
  while (taken.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

// AC 3/5/6: validiert grob, persistiert additiv (D-B: Namenskollision ->
// " (2)", " (3)", ... statt Merge/Überschreiben), markiert fehlende lokale
// Dateien als "nicht verknüpft" (D-A) statt den Import abzubrechen.
export async function importAudioBoardFromJson(db: DatabaseLike, data: unknown): Promise<AudioImportResult> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new InvalidAudioExportError('Invalid audio export: payload must be a JSON object');
  }
  const root = data as { schema_version?: unknown; scenes?: unknown };
  if (root.schema_version !== AUDIO_EXPORT_SCHEMA_VERSION) {
    throw new InvalidAudioExportError(`Invalid audio export: unknown schema_version ${JSON.stringify(root.schema_version)}`);
  }
  if (!Array.isArray(root.scenes)) {
    throw new InvalidAudioExportError('Invalid audio export: "scenes" must be an array');
  }
  const scenes = root.scenes as AudioExportScene[];

  const existingNames = new Set((await listScenes(db)).map((s) => s.name));
  const importedSceneIds: string[] = [];
  const unlinkedFiles: AudioImportUnlinkedFile[] = [];

  for (const scene of scenes) {
    const name = uniqueSceneName(scene.name, existingNames);
    existingNames.add(name);
    const { id: sceneId } = await createScene(db, { name });
    importedSceneIds.push(sceneId);

    for (const channel of scene.channels ?? []) {
      const { id: channelId } = await createChannel(db, { scene_id: sceneId, name: channel.name ?? undefined });
      await updateChannelMixer(db, channelId, {
        volume: channel.volume,
        balance: channel.balance,
        eq_low: channel.eq_low,
        eq_mid: channel.eq_mid,
        eq_high: channel.eq_high,
        mode: channel.mode,
        transition_type: channel.transition_type,
        transition_seconds: channel.transition_seconds,
        muted: channel.muted,
      });

      for (const clip of channel.clips ?? []) {
        await createPreset(db, {
          channel_id: channelId,
          source_type: clip.source_type,
          source_ref: clip.source_ref,
          base_volume: clip.base_volume,
          label: clip.label ?? undefined,
          icon: clip.icon ?? undefined,
          color: clip.color ?? undefined,
          loop: clip.loop,
        });
        // D-A: lokale Datei-Referenzen werden vom DM neu verknüpft, nie
        // gebündelt — jeder file-Clip wird gemeldet, damit die UI ihn
        // markieren kann.
        if (clip.source_type === 'file') {
          unlinkedFiles.push({ clipLabel: clip.label, sourceRef: clip.source_ref });
        }
      }
    }
  }

  return { importedSceneIds, unlinkedFiles };
}
