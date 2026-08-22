import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from '../src/services/entity-service';

type MapDb = InstanceType<typeof DatabaseSync>;

export function applyMapSchema(db: MapDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      image_width_px INTEGER NOT NULL DEFAULT 0,
      image_height_px INTEGER NOT NULL DEFAULT 0,
      calibration_json TEXT,
      folder_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_folders (
      id TEXT PRIMARY KEY NOT NULL,
      parent_id TEXT,
      name TEXT NOT NULL,
      color TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_layers (
      id TEXT PRIMARY KEY NOT NULL,
      map_id TEXT NOT NULL,
      layer_type TEXT NOT NULL,
      name TEXT,
      asset_id TEXT,
      mask_data TEXT,
      opacity REAL NOT NULL DEFAULT 1,
      z_order INTEGER NOT NULL DEFAULT 0,
      visible INTEGER NOT NULL DEFAULT 1,
      player_visible INTEGER NOT NULL DEFAULT 0,
      offset_x REAL NOT NULL DEFAULT 0,
      offset_y REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS map_tokens (
      id TEXT PRIMARY KEY NOT NULL,
      layer_id TEXT NOT NULL,
      map_id TEXT NOT NULL,
      art_asset_id TEXT,
      render_style TEXT NOT NULL DEFAULT 'token',
      art_offset_x REAL NOT NULL DEFAULT 0,
      art_offset_y REAL NOT NULL DEFAULT 0,
      scale REAL NOT NULL DEFAULT 1,
      label TEXT,
      x REAL NOT NULL,
      y REAL NOT NULL,
      ring_color TEXT,
      counters_json TEXT NOT NULL DEFAULT '[]',
      status_chips_json TEXT NOT NULL DEFAULT '[]',
      session_id TEXT,
      controller TEXT NOT NULL DEFAULT 'players',
      owner_player_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // M15-S09 (#309): migrate single-counter to counters_json array.
  // Safe to run on fresh DBs (column already exists) and on old DBs.
  try {
    db.exec(`ALTER TABLE map_tokens ADD COLUMN counters_json TEXT NOT NULL DEFAULT '[]'`);
    // Migrate existing single-counter rows to the new format.
    db.exec(`UPDATE map_tokens SET counters_json = json_array(json_object('label', COALESCE(counter_label,''), 'value', counter_value)) WHERE counter_value IS NOT NULL`);
    db.exec(`ALTER TABLE map_tokens DROP COLUMN counter_label`);
    db.exec(`ALTER TABLE map_tokens DROP COLUMN counter_value`);
  } catch {
    // Column already exists (fresh DB from new schema) — nothing to do.
  }

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
      group_name TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export async function getMarkersForMap(db: DatabaseLike, mapId: string): Promise<Array<Record<string, unknown>>> {
  return db.select<Record<string, unknown>>('SELECT * FROM map_markers WHERE map_id = ?', [mapId]);
}

export async function getMarkersForEntity(db: DatabaseLike, entityId: string): Promise<Array<Record<string, unknown>>> {
  return db.select<Record<string, unknown>>('SELECT * FROM map_markers WHERE entity_id = ?', [entityId]);
}
