// M15-S01: map_layers Schema & Migration — Layer als Basis-Primitiv (#273)
// One uniform layer primitive (image/fog/token) per map, ordered by z_order.
// layer_type is a TS union + constant, not a DB CHECK (per AC).
import type { DatabaseLike } from './entity-service';

export const LAYER_TYPES = ['image', 'fog', 'token'] as const;
export type LayerType = (typeof LAYER_TYPES)[number];

export interface MapLayerRow {
  id: string;
  map_id: string;
  layer_type: LayerType;
  name: string | null;
  asset_id: string | null;
  mask_data: string | null;
  opacity: number;
  z_order: number;
  visible: number;
  player_visible: number;
  created_at: string;
}

export interface CreateLayerParams {
  map_id: string;
  layer_type: LayerType;
  name?: string;
  asset_id?: string;
  mask_data?: string;
  opacity?: number;
}

export interface UpdateLayerPatch {
  name?: string;
  opacity?: number;
  visible?: boolean;
  player_visible?: boolean;
  mask_data?: string;
}

function clampOpacity(opacity: number): number {
  return Math.max(0, Math.min(1, opacity));
}

/** Creates a layer on a map. `opacity` is clamped to [0, 1] before write. */
export async function createLayer(db: DatabaseLike, params: CreateLayerParams): Promise<{ id: string }> {
  const id = `layer_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO map_layers (id, map_id, layer_type, name, asset_id, mask_data, opacity) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.map_id, params.layer_type, params.name ?? null, params.asset_id ?? null, params.mask_data ?? null, clampOpacity(params.opacity ?? 1)],
  );
  return { id };
}

/** Lists a map's layers ordered by z_order ascending. */
export async function listLayers(db: DatabaseLike, mapId: string): Promise<MapLayerRow[]> {
  return db.select<MapLayerRow>('SELECT * FROM map_layers WHERE map_id = ? ORDER BY z_order ASC', [mapId]);
}

/** Patches name/opacity/visible/player_visible/mask_data on a layer. `opacity` is clamped to [0, 1]. */
export async function updateLayer(db: DatabaseLike, id: string, patch: UpdateLayerPatch): Promise<void> {
  const fields: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) { fields.push('name = ?'); args.push(patch.name); }
  if (patch.opacity !== undefined) { fields.push('opacity = ?'); args.push(clampOpacity(patch.opacity)); }
  if (patch.visible !== undefined) { fields.push('visible = ?'); args.push(patch.visible ? 1 : 0); }
  if (patch.player_visible !== undefined) { fields.push('player_visible = ?'); args.push(patch.player_visible ? 1 : 0); }
  if (patch.mask_data !== undefined) { fields.push('mask_data = ?'); args.push(patch.mask_data); }
  if (fields.length === 0) return;
  args.push(id);
  await db.execute(`UPDATE map_layers SET ${fields.join(', ')} WHERE id = ?`, args);
}

/** Deletes a layer. */
export async function deleteLayer(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM map_layers WHERE id = ?', [id]);
}

/** Rewrites z_order for a map's layers to match orderedIds (0..n by array index). */
export async function reorderLayers(db: DatabaseLike, _mapId: string, orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.execute('UPDATE map_layers SET z_order = ? WHERE id = ?', [i, orderedIds[i]]);
  }
}

export interface ImportImageLayerParams {
  map_id: string;
  srcPath: string;
  projectDir: string;
  name?: string;
}

/**
 * M15-S03 (#275): imports an image (reusing map-service's existing asset-copy
 * flow — same path as the base map image import, no new importer) and
 * creates an `image` layer for it at `z_order = max(existing z_order) + 1`.
 */
export async function importImageLayer(_db: DatabaseLike, _params: ImportImageLayerParams): Promise<{ id: string }> {
  throw new Error('not implemented');
}

export interface CreateFogLayerParams {
  map_id: string;
  name?: string;
}

/**
 * M15-S04 (#276): creates a `fog` layer at `z_order = max(existing) + 1`
 * with an initial fully-covering mask_data (whole map hidden until painted).
 */
export async function createFogLayer(_db: DatabaseLike, _params: CreateFogLayerParams): Promise<{ id: string }> {
  throw new Error('not implemented');
}
