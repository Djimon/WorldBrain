// M15-S06: map_tokens Schema & Service — bewegliche Session-Tokens (#278)
// Distinct from static map_markers. layer_id references a map_layers row
// with layer_type='token' -- creating the first token on a map with no
// token layer creates that layer first (z_order = max+1).
import type { DatabaseLike } from './entity-service';
import { createTokenLayer, listLayers } from './map-layer-service';

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
  ring_color?: string | null;
  entity_id?: string | null;
}

// Raw DB row (status_chips_json string) before decoding into MapTokenRow.
interface MapTokenDbRow extends Omit<MapTokenRow, 'status_chips'> {
  status_chips_json: string;
}

// AP-006 exception: JSON.parse of DB *_json → safe fallback [] on malformed data.
function parseChips(json: string): StatusChip[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as StatusChip[]) : [];
  } catch {
    return [];
  }
}

/** Finds a map's token layer, or creates one (z_order = max+1) if none exists. */
async function ensureTokenLayer(db: DatabaseLike, mapId: string): Promise<string> {
  const layers = await listLayers(db, mapId);
  const existing = layers.find((l) => l.layer_type === 'token');
  if (existing) return existing.id;
  const { id } = await createTokenLayer(db, { map_id: mapId });
  return id;
}

/**
 * Creates a token. If the map has no `layer_type='token'` layer yet, one is
 * created first (z_order = max+1) and the new token is placed on it.
 */
export async function createToken(db: DatabaseLike, params: CreateTokenParams): Promise<{ id: string }> {
  const layerId = params.layer_id ?? (await ensureTokenLayer(db, params.map_id));
  const id = `token_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO map_tokens (id, layer_id, map_id, entity_id, label, x, y, ring_color, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, layerId, params.map_id, params.entity_id ?? null, params.label ?? null, params.x, params.y, params.ring_color ?? null, params.session_id ?? null],
  );
  return { id };
}

/**
 * Lists a map's tokens. With `sessionId`: base placements (session_id NULL)
 * plus that session's tokens. Without: base placements only.
 */
export async function listTokens(db: DatabaseLike, mapId: string, sessionId?: string): Promise<MapTokenRow[]> {
  const rows = sessionId === undefined
    ? await db.select<MapTokenDbRow>('SELECT * FROM map_tokens WHERE map_id = ? AND session_id IS NULL', [mapId])
    : await db.select<MapTokenDbRow>('SELECT * FROM map_tokens WHERE map_id = ? AND (session_id IS NULL OR session_id = ?)', [mapId, sessionId]);
  return rows.map(({ status_chips_json, ...rest }) => ({ ...rest, status_chips: parseChips(status_chips_json) }));
}

/** Moves a token to new x/y coordinates (in place, no position history). */
export async function moveToken(db: DatabaseLike, id: string, x: number, y: number): Promise<void> {
  await db.execute('UPDATE map_tokens SET x = ?, y = ? WHERE id = ?', [x, y, id]);
}

/** Sets the token's one counter (label and/or value). */
export async function setCounter(
  db: DatabaseLike,
  id: string,
  counter: { counter_label?: string | null; counter_value?: number | null },
): Promise<void> {
  const fields: string[] = [];
  const args: unknown[] = [];
  if (counter.counter_label !== undefined) { fields.push('counter_label = ?'); args.push(counter.counter_label); }
  if (counter.counter_value !== undefined) { fields.push('counter_value = ?'); args.push(counter.counter_value); }
  if (fields.length === 0) return;
  args.push(id);
  await db.execute(`UPDATE map_tokens SET ${fields.join(', ')} WHERE id = ?`, args);
}

/** Sets the token's status chips (replaces the full array). */
export async function setStatusChips(db: DatabaseLike, id: string, chips: StatusChip[]): Promise<void> {
  await db.execute('UPDATE map_tokens SET status_chips_json = ? WHERE id = ?', [JSON.stringify(chips), id]);
}

/** Patches label/ring_color/entity_id on a token. */
export async function updateToken(db: DatabaseLike, id: string, patch: UpdateTokenPatch): Promise<void> {
  const fields: string[] = [];
  const args: unknown[] = [];
  if (patch.label !== undefined) { fields.push('label = ?'); args.push(patch.label); }
  if (patch.ring_color !== undefined) { fields.push('ring_color = ?'); args.push(patch.ring_color); }
  if (patch.entity_id !== undefined) { fields.push('entity_id = ?'); args.push(patch.entity_id); }
  if (fields.length === 0) return;
  args.push(id);
  await db.execute(`UPDATE map_tokens SET ${fields.join(', ')} WHERE id = ?`, args);
}

/** Deletes a token. */
export async function deleteToken(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM map_tokens WHERE id = ?', [id]);
}
