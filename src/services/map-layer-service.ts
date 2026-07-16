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

/** Creates a layer on a map. `opacity` is clamped to [0, 1] before write. */
export async function createLayer(_db: DatabaseLike, _params: CreateLayerParams): Promise<{ id: string }> {
  throw new Error('not implemented');
}

/** Lists a map's layers ordered by z_order ascending. */
export async function listLayers(_db: DatabaseLike, _mapId: string): Promise<MapLayerRow[]> {
  throw new Error('not implemented');
}

/** Patches name/opacity/visible/player_visible/mask_data on a layer. `opacity` is clamped to [0, 1]. */
export async function updateLayer(_db: DatabaseLike, _id: string, _patch: UpdateLayerPatch): Promise<void> {
  throw new Error('not implemented');
}

/** Deletes a layer. */
export async function deleteLayer(_db: DatabaseLike, _id: string): Promise<void> {
  throw new Error('not implemented');
}

/** Rewrites z_order for a map's layers to match orderedIds (0..n by array index). */
export async function reorderLayers(_db: DatabaseLike, _mapId: string, _orderedIds: string[]): Promise<void> {
  throw new Error('not implemented');
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
