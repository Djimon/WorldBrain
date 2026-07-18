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

/** Next free z_order for a map = max(existing) + 1, or 0 for the first layer. */
async function nextZOrder(db: DatabaseLike, mapId: string): Promise<number> {
  const rows = await db.select<{ maxZ: number | null }>('SELECT MAX(z_order) AS maxZ FROM map_layers WHERE map_id = ?', [mapId]);
  const maxZ = rows[0]?.maxZ;
  return maxZ === null || maxZ === undefined ? 0 : maxZ + 1;
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
 * Purely additive: never touches maps, markers, grid, or existing layers.
 */
export async function importImageLayer(db: DatabaseLike, params: ImportImageLayerParams): Promise<{ id: string }> {
  // Dynamic import keeps this module free of Tauri deps for non-import code
  // paths (e.g. createFogLayer under node:sqlite tests).
  const { copyMapAsset } = await import('./map-asset');
  const assetPath = await copyMapAsset(params.srcPath, params.projectDir, `layer-${crypto.randomUUID()}`);
  const z = await nextZOrder(db, params.map_id);
  const id = `layer_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO map_layers (id, map_id, layer_type, name, asset_id, opacity, z_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.map_id, 'image', params.name ?? null, assetPath, 1, z],
  );
  return { id };
}

export interface CreateFogLayerParams {
  map_id: string;
  name?: string;
}

// 1x1 opaque PNG — placeholder mask for environments without a canvas 2D
// backend (jsdom/tests). Real masks are generated full-size below; fog paint
// (S04) replaces this per stroke.
const OPAQUE_1PX_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Builds a fully-covering (opaque) mask sized to the map, or a 1x1 fallback. */
async function buildFullCoverMask(db: DatabaseLike, mapId: string): Promise<string> {
  try {
    const rows = await db.select<{ w: number; h: number }>('SELECT image_width_px AS w, image_height_px AS h FROM maps WHERE id = ?', [mapId]);
    const w = rows[0]?.w;
    const h = rows[0]?.h;
    if (w && h && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        return canvas.toDataURL('image/png');
      }
    }
  } catch {
    // fall through to the placeholder
  }
  return OPAQUE_1PX_PNG;
}

/**
 * M15-S04 (#276): creates a `fog` layer at `z_order = max(existing) + 1`
 * with an initial fully-covering mask_data (whole map hidden until painted).
 * Purely additive: never touches maps, markers, grid, or existing layers.
 */
export async function createFogLayer(db: DatabaseLike, params: CreateFogLayerParams): Promise<{ id: string }> {
  const mask = await buildFullCoverMask(db, params.map_id);
  const z = await nextZOrder(db, params.map_id);
  const id = `layer_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO map_layers (id, map_id, layer_type, name, mask_data, opacity, z_order) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, params.map_id, 'fog', params.name ?? null, mask, 1, z],
  );
  return { id };
}
