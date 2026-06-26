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

export async function saveView(db: DatabaseLike, params: SaveViewParams): Promise<{ id: string }> {
  const id = 'view_' + crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT OR REPLACE INTO saved_views (id, name, view_type, config_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, params.name, params.view_type, JSON.stringify(params.config), now, now],
  );
  return { id };
}

export async function listViews(db: DatabaseLike): Promise<SavedViewRow[]> {
  return db.select<SavedViewRow>(
    `SELECT id, name, view_type, config_json, updated_at FROM saved_views ORDER BY updated_at DESC`,
  );
}

export const listSavedViews = listViews;

export async function loadView(db: DatabaseLike, id: string): Promise<{ id: string; name: string; view_type: string; config: unknown; updated_at: string } | null> {
  const rows = await db.select<SavedViewRow>(
    `SELECT id, name, view_type, config_json, updated_at FROM saved_views WHERE id = ?`,
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    view_type: row.view_type,
    config: JSON.parse(row.config_json),
    updated_at: row.updated_at,
  };
}

export async function renameView(db: DatabaseLike, id: string, name: string): Promise<void> {
  const now = new Date().toISOString();
  await db.execute(`UPDATE saved_views SET name = ?, updated_at = ? WHERE id = ?`, [name, now, id]);
}

export async function deleteView(db: DatabaseLike, id: string): Promise<void> {
  await db.execute(`DELETE FROM saved_views WHERE id = ?`, [id]);
}
