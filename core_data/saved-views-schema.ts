import { DatabaseSync } from 'node:sqlite';

type Db = InstanceType<typeof DatabaseSync>;

export function applySavedViewsSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      view_type TEXT NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
}
