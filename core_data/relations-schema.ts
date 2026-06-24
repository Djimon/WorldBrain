export interface RelationsDb {
  prepare: (sql: string) => { run: (...args: unknown[]) => void };
}

export function applyRelationsSchema(db: RelationsDb): void {
  const exec = (sql: string) => db.prepare(sql).run();

  exec(`
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

  exec(`
    CREATE TABLE IF NOT EXISTS campaign_relation_log (
      id TEXT PRIMARY KEY NOT NULL,
      relation_id TEXT NOT NULL,
      event TEXT NOT NULL,
      session_id TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
