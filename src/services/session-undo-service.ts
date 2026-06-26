import type { DatabaseLike } from './entity-service';

export async function canUndo(db: DatabaseLike, sessionId: string): Promise<boolean> {
  const rows = await db.select<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM session_log WHERE session_id = ?`,
    [sessionId],
  );
  return (rows[0]?.cnt ?? 0) > 0;
}

export async function undoLastAction(db: DatabaseLike, sessionId: string): Promise<void> {
  const entries = await db.select<{ id: string; action_type: string; payload_json: string; prev_value: string | null }>(
    `SELECT id, action_type, payload_json, prev_value FROM session_log
     WHERE session_id = ? AND action_type NOT IN ('undo', 'var_set_undone', 'var_reset_undone')
     ORDER BY rowid DESC LIMIT 1`,
    [sessionId],
  );
  const entry = entries[0];
  if (!entry) return;

  if (entry.action_type === 'var_set') {
    let payload: { varId: string; prevValue: unknown } | null = null;
    try { payload = JSON.parse(entry.payload_json) as { varId: string; prevValue: unknown }; } catch { return; }
    if (!payload?.varId) return;
    await db.execute(
      `UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`,
      [JSON.stringify(payload.prevValue), sessionId, payload.varId],
    );
    await db.execute(`UPDATE session_log SET action_type = 'var_set_undone' WHERE id = ?`, [entry.id]);
  } else if (entry.action_type === 'var_reset') {
    let payload: { varId: string } | null = null;
    try { payload = JSON.parse(entry.payload_json) as { varId: string }; } catch { return; }
    if (!payload?.varId) return;
    await db.execute(
      `UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`,
      [entry.prev_value, sessionId, payload.varId],
    );
    await db.execute(`UPDATE session_log SET action_type = 'var_reset_undone' WHERE id = ?`, [entry.id]);
  }

  const logId = 'log_' + crypto.randomUUID();
  await db.execute(
    `INSERT INTO session_log (id, session_id, action_type, payload_json, created_at) VALUES (?, ?, 'undo', ?, ?)`,
    [logId, sessionId, JSON.stringify({ undid: entry.id }), new Date().toISOString()],
  );
}
