import type { DatabaseLike } from './entity-service';

export interface VarParams {
  id: string;
  type: string;
  label: string;
  value: unknown;
  default_value?: unknown;
}

export interface VarRow {
  id: string;
  session_id: string;
  type: string;
  label: string;
  value: unknown;
  default_value: unknown;
  allow_global_override: number;
}

function parseVal(json: string | null | undefined): unknown {
  if (json == null) return null;
  try { return JSON.parse(String(json)); } catch { return null; }
}

export function setVar(db: DatabaseLike, sessionId: string, params: VarParams): void {
  const prev = getVar(db, sessionId, params.id);

  const existing = db
    .prepare(`SELECT default_value FROM session_variables WHERE session_id = ? AND id = ?`)
    .get(sessionId, params.id) as { default_value: string } | undefined;

  const defaultJson = params.default_value !== undefined
    ? JSON.stringify(params.default_value)
    : existing?.default_value ?? 'null';

  db.prepare(`
    INSERT INTO session_variables (id, session_id, type, label, value, default_value, allow_global_override)
    VALUES (?, ?, ?, ?, ?, ?, 0)
    ON CONFLICT(session_id, id) DO UPDATE SET
      type = excluded.type,
      label = excluded.label,
      value = excluded.value,
      default_value = excluded.default_value
  `).run(params.id, sessionId, params.type, params.label, JSON.stringify(params.value), defaultJson);

  const logId = 'log_' + crypto.randomUUID();
  db.prepare(`
    INSERT INTO session_log (id, session_id, action_type, payload_json, created_at)
    VALUES (?, ?, 'var_set', ?, ?)
  `).run(
    logId,
    sessionId,
    JSON.stringify({ varId: params.id, prevValue: prev?.value ?? null, newValue: params.value }),
    new Date().toISOString(),
  );
}

export function getVar(db: DatabaseLike, sessionId: string, varId: string): VarRow | null {
  const row = db
    .prepare(`SELECT id, session_id, type, label, value, default_value, allow_global_override FROM session_variables WHERE session_id = ? AND id = ?`)
    .get(sessionId, varId) as { id: string; session_id: string; type: string; label: string; value: string; default_value: string; allow_global_override: number } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    session_id: row.session_id,
    type: row.type,
    label: row.label,
    value: parseVal(row.value),
    default_value: parseVal(row.default_value),
    allow_global_override: row.allow_global_override,
  };
}

export function resetVar(db: DatabaseLike, sessionId: string, varId: string): void {
  const row = db
    .prepare(`SELECT value, default_value FROM session_variables WHERE session_id = ? AND id = ?`)
    .get(sessionId, varId) as { value: string; default_value: string } | undefined;
  if (!row) return;
  db.prepare(`UPDATE session_variables SET value = ? WHERE session_id = ? AND id = ?`)
    .run(row.default_value, sessionId, varId);

  const logId = 'log_' + crypto.randomUUID();
  db.prepare(
    `INSERT INTO session_log (id, session_id, action_type, payload_json, prev_value, created_at)
     VALUES (?, ?, 'var_reset', ?, ?, ?)`,
  ).run(
    logId,
    sessionId,
    JSON.stringify({ varId, restoredToDefault: true }),
    row.value,
    new Date().toISOString(),
  );
}

export function listVars(db: DatabaseLike, sessionId?: string): VarRow[] {
  let rows: Array<{ id: string; session_id: string; type: string; label: string; value: string; default_value: string; allow_global_override: number }>;
  if (sessionId) {
    rows = db.prepare(`SELECT * FROM session_variables WHERE session_id = ?`).all(sessionId) as typeof rows;
  } else {
    try {
      rows = db.prepare(`SELECT * FROM session_variables`).all() as typeof rows;
    } catch {
      return [];
    }
  }
  return rows.map((r) => ({
    id: r.id,
    session_id: r.session_id,
    type: r.type,
    label: r.label,
    value: parseVal(r.value),
    default_value: parseVal(r.default_value),
    allow_global_override: r.allow_global_override,
  }));
}

export function setGlobalVar(db: DatabaseLike, params: VarParams | string, value?: unknown): void {
  if (typeof params === 'string') {
    const id = params;
    try {
      db.prepare(`
        INSERT INTO global_variables (id, type, label, value)
        VALUES (?, 'unknown', ?, ?)
        ON CONFLICT(id) DO UPDATE SET value = excluded.value
      `).run(id, id, JSON.stringify(value));
    } catch { /* */ }
    return;
  }
  db.prepare(`
    INSERT INTO global_variables (id, type, label, value, default_value)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      type = excluded.type,
      label = excluded.label,
      value = excluded.value
  `).run(
    params.id,
    params.type,
    params.label,
    JSON.stringify(params.value),
    JSON.stringify(params.default_value ?? null),
  );
}

export function getGlobalVar(db: DatabaseLike, varId: string): { id: string; type: string; label: string; value: unknown } | null {
  const row = db
    .prepare(`SELECT id, type, label, value FROM global_variables WHERE id = ?`)
    .get(varId) as { id: string; type: string; label: string; value: string } | undefined;
  if (!row) return null;
  return { id: row.id, type: row.type, label: row.label, value: parseVal(row.value) };
}
