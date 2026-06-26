import type { DatabaseLike } from '../src/services/entity-service';

export async function applyRelationsSchema(db: DatabaseLike): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY NOT NULL,
      source_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      inverse_type TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      visibility_json TEXT NOT NULL DEFAULT '"public"',
      notes TEXT,
      created_in_session TEXT,
      deactivated_in_session TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS campaign_relation_log (
      id TEXT PRIMARY KEY NOT NULL,
      relation_id TEXT NOT NULL,
      event TEXT NOT NULL,
      session_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
