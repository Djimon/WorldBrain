import { DatabaseSync } from 'node:sqlite';

type MapDb = InstanceType<typeof DatabaseSync>;

export function applyMapSchema(db: MapDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      image_width_px INTEGER NOT NULL DEFAULT 0,
      image_height_px INTEGER NOT NULL DEFAULT 0,
      calibration_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_markers (
      id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL,
      entity_id TEXT,
      kind TEXT NOT NULL DEFAULT 'pin',
      geometry_json TEXT NOT NULL DEFAULT '{}',
      style_json TEXT NOT NULL DEFAULT '{}',
      visibility_json TEXT NOT NULL DEFAULT '"public"',
      label_text TEXT,
      elevation_value REAL,
      elevation_unit TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function getMarkersForMap(db: MapDb, mapId: string): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM map_markers WHERE map_id = ?').all(mapId) as Array<Record<string, unknown>>;
}

export function getMarkersForEntity(db: MapDb, entityId: string): Array<Record<string, unknown>> {
  return db.prepare('SELECT * FROM map_markers WHERE entity_id = ?').all(entityId) as Array<Record<string, unknown>>;
}
