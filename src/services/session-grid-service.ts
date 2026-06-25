import type { DatabaseLike } from './entity-service';

export interface ActivatedCell {
  cell_key: string;
  session_id: string;
  activated_at: number;
}

export function getActivatedCells(db: DatabaseLike, sessionId: string, mapId: string): ActivatedCell[] {
  return db.prepare('SELECT * FROM session_grid_cells WHERE session_id = ? AND map_id = ?').all(sessionId, mapId) as unknown as ActivatedCell[];
}

export function activateCell(db: DatabaseLike, sessionId: string, mapId: string, cellKey: string): void {
  db.prepare(
    'INSERT OR IGNORE INTO session_grid_cells (cell_key, session_id, map_id, activated_at) VALUES (?, ?, ?, ?)'
  ).run(cellKey, sessionId, mapId, Date.now());
}

export function deactivateCell(db: DatabaseLike, sessionId: string, mapId: string, cellKey: string): void {
  db.prepare('DELETE FROM session_grid_cells WHERE cell_key = ? AND session_id = ? AND map_id = ?').run(cellKey, sessionId, mapId);
}

export function clearAllCells(db: DatabaseLike, sessionId: string, mapId: string): void {
  db.prepare('DELETE FROM session_grid_cells WHERE session_id = ? AND map_id = ?').run(sessionId, mapId);
}
