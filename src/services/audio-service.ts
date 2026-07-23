// M15-S11 (#282): audio-service — Scenes/Channels/Presets CRUD + reorder +
// clamped mixer updates + one-shot nested board load (listScene).
import type { DatabaseLike } from './entity-service';

export type ChannelMode = 'replace' | 'add';
export type TransitionType = 'cut' | 'fade';
// 'spotify' is a crude, deliberately reduced tier (no volume/fade at all —
// the public embed has no setVolume; see spotify-tier-engine.ts).
export type SourceType = 'file' | 'link' | 'spotify';

const VALID_MODES: ChannelMode[] = ['replace', 'add'];
const VALID_TRANSITIONS: TransitionType[] = ['cut', 'fade'];
const VALID_SOURCE_TYPES: SourceType[] = ['file', 'link', 'spotify'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface AudioSceneRow {
  id: string;
  name: string;
  order_index: number;
  created_at: string;
}

export interface AudioChannelRow {
  id: string;
  scene_id: string;
  name: string | null;
  order_index: number;
  mode: ChannelMode;
  volume: number;
  balance: number;
  eq_low: number;
  eq_mid: number;
  eq_high: number;
  transition_type: TransitionType;
  transition_seconds: number;
  muted: number;
}

export interface AudioPresetRow {
  id: string;
  channel_id: string;
  order_index: number;
  source_type: SourceType;
  source_ref: string;
  base_volume: number;
  label: string | null;
  icon: string | null;
  color: string | null;
  loop: number;
  created_at: string;
}

export interface SceneWithChannels extends AudioSceneRow {
  channels: (AudioChannelRow & { presets: AudioPresetRow[] })[];
}

// ── Scenes ────────────────────────────────────────────────────────────────

export async function listScenes(db: DatabaseLike): Promise<AudioSceneRow[]> {
  return db.select<AudioSceneRow>('SELECT * FROM audio_scenes ORDER BY order_index');
}

export async function createScene(db: DatabaseLike, params: { name: string }): Promise<{ id: string }> {
  const id = `scene_${crypto.randomUUID()}`;
  const existing = await listScenes(db);
  await db.execute('INSERT INTO audio_scenes (id, name, order_index) VALUES (?, ?, ?)', [id, params.name, existing.length]);
  return { id };
}

export async function renameScene(db: DatabaseLike, id: string, name: string): Promise<void> {
  await db.execute('UPDATE audio_scenes SET name = ? WHERE id = ?', [name, id]);
}

export async function reorderScenes(db: DatabaseLike, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE audio_scenes SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export async function deleteScene(db: DatabaseLike, id: string): Promise<void> {
  const channels = await db.select<{ id: string }>('SELECT id FROM audio_channels WHERE scene_id = ?', [id]);
  for (const channel of channels) {
    await db.execute('DELETE FROM audio_presets WHERE channel_id = ?', [channel.id]);
  }
  await db.execute('DELETE FROM audio_channels WHERE scene_id = ?', [id]);
  await db.execute('DELETE FROM audio_scenes WHERE id = ?', [id]);
}

export async function duplicateScene(db: DatabaseLike, sceneId: string, newName: string): Promise<{ id: string }> {
  const scene = await listScene(db, sceneId);
  const newSceneId = `scene_${crypto.randomUUID()}`;
  const existing = await listScenes(db);
  await db.execute('INSERT INTO audio_scenes (id, name, order_index) VALUES (?, ?, ?)', [newSceneId, newName, existing.length]);
  if (!scene) return { id: newSceneId };
  for (const channel of scene.channels) {
    const newChannelId = `chan_${crypto.randomUUID()}`;
    await db.execute(
      `INSERT INTO audio_channels
       (id, scene_id, name, order_index, mode, volume, balance, eq_low, eq_mid, eq_high, transition_type, transition_seconds, muted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newChannelId, newSceneId, channel.name, channel.order_index, channel.mode, channel.volume, channel.balance,
        channel.eq_low, channel.eq_mid, channel.eq_high, channel.transition_type, channel.transition_seconds, channel.muted],
    );
    for (const preset of channel.presets) {
      const newPresetId = `clip_${crypto.randomUUID()}`;
      await db.execute(
        `INSERT INTO audio_presets (id, channel_id, order_index, source_type, source_ref, base_volume, label, icon, color, loop)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [newPresetId, newChannelId, preset.order_index, preset.source_type, preset.source_ref, preset.base_volume,
          preset.label, preset.icon, preset.color, preset.loop],
      );
    }
  }
  return { id: newSceneId };
}

/** One-shot nested load: a scene with its channels (ordered), each with its presets (ordered) — for board mount. */
export async function listScene(db: DatabaseLike, sceneId: string): Promise<SceneWithChannels | null> {
  const scenes = await db.select<AudioSceneRow>('SELECT * FROM audio_scenes WHERE id = ?', [sceneId]);
  const scene = scenes[0];
  if (!scene) return null;
  const channels = await listChannels(db, sceneId);
  const channelsWithPresets = await Promise.all(
    channels.map(async (channel) => ({ ...channel, presets: await listPresets(db, channel.id) })),
  );
  return { ...scene, channels: channelsWithPresets };
}

// ── Channels ──────────────────────────────────────────────────────────────

export async function listChannels(db: DatabaseLike, sceneId: string): Promise<AudioChannelRow[]> {
  return db.select<AudioChannelRow>('SELECT * FROM audio_channels WHERE scene_id = ? ORDER BY order_index', [sceneId]);
}

export async function createChannel(db: DatabaseLike, params: { scene_id: string; name?: string }): Promise<{ id: string }> {
  const id = `chan_${crypto.randomUUID()}`;
  const existing = await listChannels(db, params.scene_id);
  await db.execute(
    'INSERT INTO audio_channels (id, scene_id, name, order_index) VALUES (?, ?, ?, ?)',
    [id, params.scene_id, params.name ?? null, existing.length],
  );
  return { id };
}

export async function renameChannel(db: DatabaseLike, id: string, name: string): Promise<void> {
  await db.execute('UPDATE audio_channels SET name = ? WHERE id = ?', [name, id]);
}

export async function reorderChannels(db: DatabaseLike, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE audio_channels SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export async function deleteChannel(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM audio_presets WHERE channel_id = ?', [id]);
  await db.execute('DELETE FROM audio_channels WHERE id = ?', [id]);
}

export interface ChannelMixerPatch {
  volume?: number;
  balance?: number;
  eq_low?: number;
  eq_mid?: number;
  eq_high?: number;
  mode?: ChannelMode;
  transition_type?: TransitionType;
  transition_seconds?: number;
  muted?: boolean;
}

export async function updateChannelMixer(db: DatabaseLike, id: string, patch: ChannelMixerPatch): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.volume !== undefined) { sets.push('volume = ?'); args.push(clamp(patch.volume, 0, 1)); }
  if (patch.balance !== undefined) { sets.push('balance = ?'); args.push(clamp(patch.balance, -1, 1)); }
  if (patch.eq_low !== undefined) { sets.push('eq_low = ?'); args.push(clamp(patch.eq_low, -12, 12)); }
  if (patch.eq_mid !== undefined) { sets.push('eq_mid = ?'); args.push(clamp(patch.eq_mid, -12, 12)); }
  if (patch.eq_high !== undefined) { sets.push('eq_high = ?'); args.push(clamp(patch.eq_high, -12, 12)); }
  if (patch.mode !== undefined) {
    if (!VALID_MODES.includes(patch.mode)) throw new Error(`Invalid channel mode: ${patch.mode}`);
    sets.push('mode = ?'); args.push(patch.mode);
  }
  if (patch.transition_type !== undefined) {
    if (!VALID_TRANSITIONS.includes(patch.transition_type)) throw new Error(`Invalid transition type: ${patch.transition_type}`);
    sets.push('transition_type = ?'); args.push(patch.transition_type);
  }
  if (patch.transition_seconds !== undefined) { sets.push('transition_seconds = ?'); args.push(patch.transition_seconds); }
  if (patch.muted !== undefined) { sets.push('muted = ?'); args.push(patch.muted ? 1 : 0); }
  if (sets.length === 0) return;
  args.push(id);
  await db.execute(`UPDATE audio_channels SET ${sets.join(', ')} WHERE id = ?`, args);
}

// ── Presets (clips) ───────────────────────────────────────────────────────

export async function listPresets(db: DatabaseLike, channelId: string): Promise<AudioPresetRow[]> {
  return db.select<AudioPresetRow>('SELECT * FROM audio_presets WHERE channel_id = ? ORDER BY order_index', [channelId]);
}

export interface CreatePresetParams {
  channel_id: string;
  source_type: SourceType;
  source_ref: string;
  base_volume?: number;
  label?: string;
  icon?: string;
  color?: string;
  loop?: boolean;
}

export async function createPreset(db: DatabaseLike, params: CreatePresetParams): Promise<{ id: string }> {
  if (!VALID_SOURCE_TYPES.includes(params.source_type)) throw new Error(`Invalid source type: ${params.source_type}`);
  const id = `clip_${crypto.randomUUID()}`;
  const existing = await listPresets(db, params.channel_id);
  await db.execute(
    `INSERT INTO audio_presets (id, channel_id, order_index, source_type, source_ref, base_volume, label, icon, color, loop)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.channel_id, existing.length, params.source_type, params.source_ref, clamp(params.base_volume ?? 1, 0, 1),
      params.label ?? null, params.icon ?? null, params.color ?? null, params.loop ? 1 : 0],
  );
  return { id };
}

export interface PresetPatch {
  source_type?: SourceType;
  source_ref?: string;
  base_volume?: number;
  label?: string;
  icon?: string;
  color?: string;
  loop?: boolean;
}

export async function updatePreset(db: DatabaseLike, id: string, patch: PresetPatch): Promise<void> {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.source_type !== undefined) {
    if (!VALID_SOURCE_TYPES.includes(patch.source_type)) throw new Error(`Invalid source type: ${patch.source_type}`);
    sets.push('source_type = ?'); args.push(patch.source_type);
  }
  if (patch.source_ref !== undefined) { sets.push('source_ref = ?'); args.push(patch.source_ref); }
  if (patch.base_volume !== undefined) { sets.push('base_volume = ?'); args.push(clamp(patch.base_volume, 0, 1)); }
  if (patch.label !== undefined) { sets.push('label = ?'); args.push(patch.label); }
  if (patch.icon !== undefined) { sets.push('icon = ?'); args.push(patch.icon); }
  if (patch.color !== undefined) { sets.push('color = ?'); args.push(patch.color); }
  if (patch.loop !== undefined) { sets.push('loop = ?'); args.push(patch.loop ? 1 : 0); }
  if (sets.length === 0) return;
  args.push(id);
  await db.execute(`UPDATE audio_presets SET ${sets.join(', ')} WHERE id = ?`, args);
}

export async function deletePreset(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM audio_presets WHERE id = ?', [id]);
}

export async function reorderPresets(db: DatabaseLike, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE audio_presets SET order_index = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}
