import { DatabaseSync } from 'node:sqlite';

type EventDb = InstanceType<typeof DatabaseSync>;

export function applyEventSchema(db: EventDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      start_day INTEGER NOT NULL DEFAULT 0,
      end_day INTEGER,
      precision TEXT NOT NULL DEFAULT 'day',
      visibility TEXT NOT NULL DEFAULT 'public',
      participants_json TEXT NOT NULL DEFAULT '[]',
      locations_json TEXT NOT NULL DEFAULT '[]',
      variable_triggers_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
