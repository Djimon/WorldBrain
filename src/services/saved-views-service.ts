import type { DatabaseLike } from './entity-service';

export interface SavedViewRow {
  id: string;
  name: string;
  view_type: string;
  config_json: string;
  updated_at: string;
}

export interface SaveViewParams {
  name: string;
  view_type: string;
  config: unknown;
}

export function saveView(db: DatabaseLike, params: SaveViewParams): { id: string } {
  const id = 'view_' + crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT OR REPLACE INTO saved_views (id, name, view_type, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, params.name, params.view_type, JSON.stringify(params.config), now, now);
  return { id };
}

export function listViews(db: DatabaseLike): SavedViewRow[] {
  return db.prepare(`SELECT id, name, view_type, config_json, updated_at FROM saved_views ORDER BY updated_at DESC`).all() as SavedViewRow[];
}

export function loadView(db: DatabaseLike, id: string): { id: string; name: string; view_type: string; config: unknown; updated_at: string } | null {
  const row = db.prepare(`SELECT id, name, view_type, config_json, updated_at FROM saved_views WHERE id = ?`).get(id) as SavedViewRow | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    view_type: row.view_type,
    config: JSON.parse(row.config_json),
    updated_at: row.updated_at,
  };
}

export function renameView(db: DatabaseLike, id: string, name: string): void {
  const now = new Date().toISOString();
  db.prepare(`UPDATE saved_views SET name = ?, updated_at = ? WHERE id = ?`).run(name, now, id);
}

export function deleteView(db: DatabaseLike, id: string): void {
  db.prepare(`DELETE FROM saved_views WHERE id = ?`).run(id);
}
