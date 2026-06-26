import type { DatabaseLike } from './entity-service';
import { TauriSqlAdapter } from './tauri-sql-adapter';
import { applyCalendarSchema } from '../../core_data/calendar-schema';
import { applyCardSchema } from '../../core_data/card-schema';
import { applyEventSchema } from '../../core_data/event-schema';
import { applyHandoutSchema } from '../../core_data/handout-schema';
import { applyMapSchema } from '../../core_data/map-schema';
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

  await adapter.execute(`
    CREATE TABLE IF NOT EXISTS campaign_entity_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_id TEXT NOT NULL,
      patch_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await adapter.execute(`ALTER TABLE maps ADD COLUMN grid_json TEXT`).catch(() => {});
  await adapter.execute(`ALTER TABLE map_markers ADD COLUMN group_name TEXT NOT NULL DEFAULT ''`).catch(() => {});

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
  applyCardSchema(db as unknown as Parameters<typeof applyCardSchema>[0]);
  applyEventSchema(db as unknown as Parameters<typeof applyEventSchema>[0]);
  applyHandoutSchema(db as unknown as Parameters<typeof applyHandoutSchema>[0]);
  applyMapSchema(db as unknown as Parameters<typeof applyMapSchema>[0]);
  applySavedViewsSchema(db as unknown as Parameters<typeof applySavedViewsSchema>[0]);
  await applySearchSchema(adapter);
  applySessionSchema(db as unknown as Parameters<typeof applySessionSchema>[0]);
  await applyRelationsSchema(adapter);
  applyRuleSchema(adapter);

  // Drain all fire-and-forget schema exec() calls before returning.
  await adapter.flush();

  return adapter;
}
