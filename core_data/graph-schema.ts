// M16-S10 (#327): project-local cache for precomputed graph-layout
// positions. Key = structureHash(model). On a cache hit the
// consumer loads directly (no cold settle in the renderer).
import { DatabaseSync } from 'node:sqlite';

type Db = InstanceType<typeof DatabaseSync>;

export function applyGraphSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS graph_layout_cache (
      structure_hash TEXT PRIMARY KEY,
      positions_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}
