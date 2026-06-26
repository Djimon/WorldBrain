import type { DatabaseLike } from './entity-service';

export interface GridCell {
  cell_key: string;
  session_id: string;
  map_id: string;
  state: number;
  activated_at: number;
}

export async function getActivatedCells(db: DatabaseLike, sessionId: string, mapId: string): Promise<GridCell[]> {
  return db.select<GridCell>('SELECT * FROM session_grid_cells WHERE session_id = ? AND map_id = ?', [sessionId, mapId]);
}

export async function setCellState(db: DatabaseLike, sessionId: string, mapId: string, cellKey: string, state: number): Promise<void> {
  if (state === 0) {
    await db.execute('DELETE FROM session_grid_cells WHERE cell_key = ? AND session_id = ? AND map_id = ?', [cellKey, sessionId, mapId]);
  } else {
    await db.execute(
      'INSERT INTO session_grid_cells (cell_key, session_id, map_id, state, activated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(cell_key, session_id, map_id) DO UPDATE SET state = excluded.state',
      [cellKey, sessionId, mapId, state, Date.now()],
    );
  }
}

export async function activateCell(db: DatabaseLike, sessionId: string, mapId: string, cellKey: string): Promise<void> {
  await setCellState(db, sessionId, mapId, cellKey, 1);
}

export async function deactivateCell(db: DatabaseLike, sessionId: string, mapId: string, cellKey: string): Promise<void> {
  await setCellState(db, sessionId, mapId, cellKey, 0);
}

export async function clearAllCells(db: DatabaseLike, sessionId: string, mapId: string): Promise<void> {
  await db.execute('DELETE FROM session_grid_cells WHERE session_id = ? AND map_id = ?', [sessionId, mapId]);
}
