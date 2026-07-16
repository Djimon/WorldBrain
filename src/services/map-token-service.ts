// M15-S06: map_tokens Schema & Service — bewegliche Session-Tokens (#278)
// Distinct from static map_markers. layer_id references a map_layers row
// with layer_type='token' -- creating the first token on a map with no
// token layer creates that layer first (z_order = max+1).
import type { DatabaseLike } from './entity-service';

export interface StatusChip {
  icon: string;
  color?: string;
  text?: string;
}

export interface MapTokenRow {
  id: string;
  layer_id: string;
  map_id: string;
  entity_id: string | null;
  label: string | null;
  x: number;
  y: number;
  ring_color: string | null;
  counter_label: string | null;
  counter_value: number | null;
  status_chips: StatusChip[];
  session_id: string | null;
  created_at: string;
}

export interface CreateTokenParams {
  layer_id?: string;
  map_id: string;
  entity_id?: string;
  label?: string;
  x: number;
  y: number;
  ring_color?: string;
  session_id?: string;
}

export interface UpdateTokenPatch {
  label?: string;
  ring_color?: string;
  entity_id?: string;
}

/**
 * Creates a token. If the map has no `layer_type='token'` layer yet, one is
 * created first (z_order = max+1) and the new token is placed on it.
 */
export async function createToken(_db: DatabaseLike, _params: CreateTokenParams): Promise<{ id: string }> {
  throw new Error('not implemented');
}

/** Lists a map's tokens, optionally scoped to a session (session_id = NULL means base placement). */
export async function listTokens(_db: DatabaseLike, _mapId: string, _sessionId?: string): Promise<MapTokenRow[]> {
  throw new Error('not implemented');
}

/** Moves a token to new x/y coordinates (in place, no position history). */
export async function moveToken(_db: DatabaseLike, _id: string, _x: number, _y: number): Promise<void> {
  throw new Error('not implemented');
}

/** Sets the token's one counter (label and/or value). */
export async function setCounter(
  _db: DatabaseLike,
  _id: string,
  _counter: { counter_label?: string; counter_value?: number },
): Promise<void> {
  throw new Error('not implemented');
}

/** Sets the token's status chips (replaces the full array). */
export async function setStatusChips(_db: DatabaseLike, _id: string, _chips: StatusChip[]): Promise<void> {
  throw new Error('not implemented');
}

/** Patches label/ring_color/entity_id on a token. */
export async function updateToken(_db: DatabaseLike, _id: string, _patch: UpdateTokenPatch): Promise<void> {
  throw new Error('not implemented');
}

/** Deletes a token. */
export async function deleteToken(_db: DatabaseLike, _id: string): Promise<void> {
  throw new Error('not implemented');
}
