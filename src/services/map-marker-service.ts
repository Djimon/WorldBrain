import type { DatabaseLike } from './entity-service';

export interface MarkerRow {
  id: string;
  map_id: string;
  entity_id: string | null;
  kind: string;
  geometry_json: string;
  label_text: string | null;
  elevation_value: number | null;
  elevation_unit: string | null;
  visibility_json: string;
  style_json: string;
  group_name: string;
}

export async function getMarkersForMap(db: DatabaseLike, mapId: string): Promise<MarkerRow[]> {
  return db.select<MarkerRow>('SELECT * FROM map_markers WHERE map_id = ?', [mapId]);
}

export async function createMarker(db: DatabaseLike, data: Omit<MarkerRow, 'id'>): Promise<{ id: string }> {
  const id = 'mk_' + crypto.randomUUID();
  await db.execute(
    `INSERT INTO map_markers (id, map_id, entity_id, kind, geometry_json, label_text, elevation_value, elevation_unit, visibility_json, group_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.map_id, data.entity_id ?? null, data.kind, data.geometry_json,
     data.label_text ?? null, data.elevation_value ?? null, data.elevation_unit ?? null, data.visibility_json,
     data.group_name ?? ''],
  );
  return { id };
}

export async function updateMarker(db: DatabaseLike, id: string, patch: Partial<MarkerRow>): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];
  if (patch.label_text !== undefined) { fields.push('label_text = ?'); values.push(patch.label_text); }
  if (patch.entity_id !== undefined) { fields.push('entity_id = ?'); values.push(patch.entity_id); }
  if (patch.geometry_json !== undefined) { fields.push('geometry_json = ?'); values.push(patch.geometry_json); }
  if (patch.group_name !== undefined) { fields.push('group_name = ?'); values.push(patch.group_name); }
  if (patch.style_json !== undefined) { fields.push('style_json = ?'); values.push(patch.style_json); }
  if (!fields.length) return;
  values.push(id);
  await db.execute(`UPDATE map_markers SET ${fields.join(', ')} WHERE id = ?`, values);
}

export async function deleteMarker(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM map_markers WHERE id = ?', [id]);
}
