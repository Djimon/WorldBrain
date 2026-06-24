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
}

export function getMarkersForMap(db: DatabaseLike, mapId: string): MarkerRow[] {
  return db.prepare('SELECT * FROM map_markers WHERE map_id = ?').all(mapId) as unknown as MarkerRow[];
}

export function createMarker(db: DatabaseLike, data: Omit<MarkerRow, 'id'>): { id: string } {
  const id = 'mk_' + crypto.randomUUID();
  db.prepare(
    `INSERT INTO map_markers (id, map_id, entity_id, kind, geometry_json, label_text, elevation_value, elevation_unit, visibility_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.map_id, data.entity_id ?? null, data.kind, data.geometry_json, data.label_text ?? null, data.elevation_value ?? null, data.elevation_unit ?? null, data.visibility_json);
  return { id };
}

export function updateMarker(db: DatabaseLike, id: string, patch: Partial<MarkerRow>): void {
  if (patch.label_text !== undefined) db.prepare('UPDATE map_markers SET label_text = ? WHERE id = ?').run(patch.label_text, id);
}

export function deleteMarker(db: DatabaseLike, id: string): void {
  db.prepare('DELETE FROM map_markers WHERE id = ?').run(id);
}
