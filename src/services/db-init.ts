import type { DatabaseLike } from './entity-service';
import { TauriSqlAdapter } from './tauri-sql-adapter';
import { applyAudioSchema } from '../../core_data/audio-schema';
import { applyCalendarSchema } from '../../core_data/calendar-schema';
import { applyCardSchema } from '../../core_data/card-schema';
import { applyHandoutSchema } from '../../core_data/handout-schema';
import { applyGraphSchema } from '../../core_data/graph-schema';
import { applyMapSchema } from '../../core_data/map-schema';
import { applyMultiplayerSchema } from '../../core_data/multiplayer-schema';
import { applyRelationsSchema } from '../../core_data/relations-schema';
import { applyRuleSchema } from '../../core_data/rule-schema';
import { applySavedViewsSchema } from '../../core_data/saved-views-schema';
import { applySearchSchema } from '../../core_data/search-schema';
import { applySessionSchema } from '../../core_data/session-schema';

// Schema helpers were typed against DatabaseSync.exec(). TauriSqlAdapter.exec() satisfies
// the runtime contract (fire-and-forget, serialized by SQLite). Cast through unknown.
type SchemaDb = Parameters<typeof applyCalendarSchema>[0];

export async function openProjectDb(dbPath: string): Promise<DatabaseLike> {
  const adapter = await TauriSqlAdapter.load(dbPath);
  const db = adapter as unknown as SchemaDb;

  await adapter.execute('PRAGMA journal_mode=WAL;');

  // Core entity table — must exist before all other schemas
  await adapter.execute(`
    CREATE TABLE IF NOT EXISTS base_entities (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      properties_json TEXT NOT NULL DEFAULT '{}',
      aliases_json TEXT NOT NULL DEFAULT '[]',
      body_json TEXT NOT NULL DEFAULT '{"format":"portable_blocks_v1","blocks":[]}',
      visibility TEXT NOT NULL DEFAULT 'public',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  // Idempotent column additions for existing DBs
  await adapter.execute(`ALTER TABLE base_entities ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]'`).catch(() => {});
  await adapter.execute(`ALTER TABLE base_entities ADD COLUMN body_json TEXT NOT NULL DEFAULT '{"format":"portable_blocks_v1","blocks":[]}'`).catch(() => {});
  await adapter.execute(`ALTER TABLE base_entities ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public'`).catch(() => {});

  // M10-S20 (D23): campaign-scoped overrides. Fresh shape ist campaign_id NOT
  // NULL + updated_at; auf alten DBs ziehen die ALTERs die Spalten nach (die
  // Alt-Rows kriegen '' als campaign_id → Dev-DB wegwerfbar, Epic D23).
  await adapter.execute(`
    CREATE TABLE IF NOT EXISTS campaign_entity_overrides (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL DEFAULT '',
      entity_id TEXT NOT NULL,
      patch_json TEXT NOT NULL DEFAULT '{}',
      promoted_at TEXT,
      pre_promote_json TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  await adapter.execute(`ALTER TABLE campaign_entity_overrides ADD COLUMN campaign_id TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await adapter.execute(`ALTER TABLE campaign_entity_overrides ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'))`).catch(() => {});
  // M10-S21 (#365): Promote-Reversibilität + Upsert-Key. ALTER für bestehende
  // Dev-DBs (idempotent via catch), CREATE-Spalten oben für frische DBs.
  await adapter.execute(`ALTER TABLE campaign_entity_overrides ADD COLUMN promoted_at TEXT`).catch(() => {});
  await adapter.execute(`ALTER TABLE campaign_entity_overrides ADD COLUMN pre_promote_json TEXT`).catch(() => {});
  await adapter.execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_entity_overrides_key ON campaign_entity_overrides (campaign_id, entity_id)`,
  ).catch(() => {});

  await adapter.execute(`ALTER TABLE maps ADD COLUMN grid_json TEXT`).catch(() => {});

  await adapter.execute(`
    CREATE TABLE IF NOT EXISTS session_grid_cells (
      cell_key TEXT NOT NULL,
      session_id TEXT NOT NULL,
      map_id TEXT NOT NULL,
      state INTEGER NOT NULL DEFAULT 1,
      activated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (cell_key, session_id, map_id)
    )
  `);

  applyCalendarSchema(db);
  await adapter.execute(`ALTER TABLE calendars ADD COLUMN epoch_anchor_day INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await adapter.execute(`ALTER TABLE calendars ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0`).catch(() => {});
  await adapter.execute(`ALTER TABLE calendars ADD COLUMN start_year INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE calendars ADD COLUMN start_month INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE calendars ADD COLUMN start_day INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN name TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN start_year INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN abbr TEXT NOT NULL DEFAULT ''`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN start_month INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN start_day INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN end_year INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN end_month INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  await adapter.execute(`ALTER TABLE eras ADD COLUMN end_day INTEGER NOT NULL DEFAULT 1`).catch(() => {});
  applyCardSchema(db as unknown as Parameters<typeof applyCardSchema>[0]);
  applyHandoutSchema(db as unknown as Parameters<typeof applyHandoutSchema>[0]);
  applyMapSchema(db as unknown as Parameters<typeof applyMapSchema>[0]);
  // Idempotent: adds folder_id to maps on pre-folder-tree DBs (map_folders table now exists).
  await adapter.execute(`ALTER TABLE maps ADD COLUMN folder_id TEXT`).catch(() => {});
  // Idempotent: adds color to map_folders on DBs from before the folder-color feature.
  await adapter.execute(`ALTER TABLE map_folders ADD COLUMN color TEXT`).catch(() => {});
  // Idempotent: adds group_name to map_markers on pre-folder DBs (table now exists).
  await adapter.execute(`ALTER TABLE map_markers ADD COLUMN group_name TEXT NOT NULL DEFAULT ''`).catch(() => {});
  // Idempotent: per-image-layer position (movable image layers).
  await adapter.execute(`ALTER TABLE map_layers ADD COLUMN offset_x REAL NOT NULL DEFAULT 0`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_layers ADD COLUMN offset_y REAL NOT NULL DEFAULT 0`).catch(() => {});
  // Idempotent: image-based tokens (#298). Token is map-local, no entity link.
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN art_asset_id TEXT`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN render_style TEXT NOT NULL DEFAULT 'token'`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN art_offset_x REAL NOT NULL DEFAULT 0`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN art_offset_y REAL NOT NULL DEFAULT 0`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN scale REAL NOT NULL DEFAULT 1`).catch(() => {});
  // M15-S09 (#309): Single-counter → counters_json. Alle 4 Statements
  // idempotent — .catch(() => {}) fängt „duplicate column", „no such
  // column" beide Richtungen (fresh DB / alte DB).
  await adapter.execute(`ALTER TABLE map_tokens ADD COLUMN counters_json TEXT NOT NULL DEFAULT '[]'`).catch(() => {});
  await adapter.execute(`UPDATE map_tokens SET counters_json = json_array(json_object('label', COALESCE(counter_label,''), 'value', counter_value)) WHERE counter_value IS NOT NULL`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens DROP COLUMN counter_label`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_tokens DROP COLUMN counter_value`).catch(() => {});
  applySavedViewsSchema(db as unknown as Parameters<typeof applySavedViewsSchema>[0]);
  await applySearchSchema(adapter);
  applySessionSchema(db as unknown as Parameters<typeof applySessionSchema>[0]);
  // M10-S20 (D23): Termin → Campaign-Bindung. Idempotent für alte DBs.
  await adapter.execute(`ALTER TABLE sessions ADD COLUMN campaign_id TEXT`).catch(() => {});
  await applyRelationsSchema(adapter);
  // One-time (idempotent) cleanup: relations left dangling by deletes that
  // predate deleteEntity's cascade (or any other path that removed an entity
  // without cleaning up its relations) — a relation pointing at a
  // non-existent entity is never valid, drop it on every open.
  await adapter.execute(
    `DELETE FROM relations WHERE source_id NOT IN (SELECT id FROM base_entities) OR target_id NOT IN (SELECT id FROM base_entities)`,
  ).catch(() => {});
  applyRuleSchema(adapter);
  applyAudioSchema(db as unknown as Parameters<typeof applyAudioSchema>[0]);
  // M10 Rebuild: campaigns/players/session_players/player_groups/group_members/
  // invite_codes/session_visibility_overrides/campaign_notes.
  applyMultiplayerSchema(db as unknown as Parameters<typeof applyMultiplayerSchema>[0]);
  // M16-S10 (#327): graph_layout_cache — persist the precomputed layout so
  // the renderer opens instantly (no cold-settle).
  applyGraphSchema(db as unknown as Parameters<typeof applyGraphSchema>[0]);

  // Drain all fire-and-forget schema exec() calls before returning.
  await adapter.flush();

  return adapter;
}
