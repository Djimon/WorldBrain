// M16-S10 (#327): projekt-lokaler Cache für vorberechnete Graph-Layout-
// Positionen. Schlüssel = structureHash(model). Bei Cache-Hit lädt der
// Consumer direkt (kein Cold-Settle im Renderer).
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
