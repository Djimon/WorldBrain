import type { DatabaseLike } from './entity-service';

export function canUndo(db: DatabaseLike, sessionId: string): boolean {
  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = ? AND action_type = 'var_set'`)
    .get(sessionId) as { cnt: number };
  return row.cnt > 0;
}

export function undoLastAction(db: DatabaseLike, sessionId: string): void {
  const entry = db
    .prepare(
      `SELECT id, payload_json FROM session_log WHERE session_id = ? AND action_type = 'var_set'
       ORDER BY rowid DESC LIMIT 1`,
    )
    .get(sessionId) as { id: string; payload_json: string } | undefined;

  if (!entry) return;

  let payload: { varId: string; prevValue: unknown } | null = null;
  try {
    payload = JSON.parse(entry.payload_json) as { varId: string; prevValue: unknown };
  } catch {
    return;
  }

  if (!payload?.varId) return;

  // Restore the previous value directly (no recursive setVar to avoid extra log entries cascading)
  db.prepare(
    `UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`,
  ).run(JSON.stringify(payload.prevValue), sessionId, payload.varId);

  // Log the undo action
  const logId = 'log_' + crypto.randomUUID();
  db.prepare(
    `INSERT INTO session_log (id, session_id, action_type, payload_json, created_at)
     VALUES (?, ?, 'undo', ?, ?)`,
  ).run(logId, sessionId, JSON.stringify({ undid: entry.id }), new Date().toISOString());

  // Mark the original var_set as undone by changing its action_type
  db.prepare(`UPDATE session_log SET action_type = 'var_set_undone' WHERE id = ?`).run(entry.id);
}
