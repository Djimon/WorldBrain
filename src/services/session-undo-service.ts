import type { DatabaseLike } from './entity-service';

export function canUndo(db: DatabaseLike, sessionId: string): boolean {
  const row = db
    .prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = ?`)
    .get(sessionId) as { cnt: number };
  return row.cnt > 0;
}

export function undoLastAction(db: DatabaseLike, sessionId: string): void {
  const entry = db
    .prepare(
      `SELECT id, action_type, payload_json, prev_value FROM session_log
       WHERE session_id = ? AND action_type NOT IN ('undo', 'var_set_undone', 'var_reset_undone')
       ORDER BY rowid DESC LIMIT 1`,
    )
    .get(sessionId) as { id: string; action_type: string; payload_json: string; prev_value: string | null } | undefined;

  if (!entry) return;

  if (entry.action_type === 'var_set') {
    let payload: { varId: string; prevValue: unknown } | null = null;
    try {
      payload = JSON.parse(entry.payload_json) as { varId: string; prevValue: unknown };
    } catch {
      return;
    }
    if (!payload?.varId) return;

    db.prepare(
      `UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`,
    ).run(JSON.stringify(payload.prevValue), sessionId, payload.varId);

    db.prepare(`UPDATE session_log SET action_type = 'var_set_undone' WHERE id = ?`).run(entry.id);
  } else if (entry.action_type === 'var_reset') {
    let payload: { varId: string } | null = null;
    try {
      payload = JSON.parse(entry.payload_json) as { varId: string };
    } catch {
      return;
    }
    if (!payload?.varId) return;

    db.prepare(
      `UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`,
    ).run(entry.prev_value, sessionId, payload.varId);

    db.prepare(`UPDATE session_log SET action_type = 'var_reset_undone' WHERE id = ?`).run(entry.id);
  }

  const logId = 'log_' + crypto.randomUUID();
  db.prepare(
    `INSERT INTO session_log (id, session_id, action_type, payload_json, created_at)
     VALUES (?, ?, 'undo', ?, ?)`,
  ).run(logId, sessionId, JSON.stringify({ undid: entry.id }), new Date().toISOString());
}
