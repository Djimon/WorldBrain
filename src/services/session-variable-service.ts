import type { DatabaseLike } from './entity-service';

export interface VarRow {
  id: string;
  type: string;
  label: string;
  value: unknown;
  default_value: unknown;
}

export function setGlobalVar(db: DatabaseLike, id: string, value: unknown): void {
  try {
    db.prepare('UPDATE session_vars SET value = ? WHERE id = ?').run(JSON.stringify(value), id);
  } catch { /* no-op */ }
}

export function getGlobalVar(db: DatabaseLike, id: string): unknown {
  try {
    const row = db.prepare('SELECT value FROM session_vars WHERE id = ?').get(id) as Record<string, unknown> | null | undefined;
    if (!row) return null;
    return JSON.parse(String(row.value));
  } catch {
    return null;
  }
}

export function listVars(db: DatabaseLike): VarRow[] {
  try {
    return db.prepare('SELECT * FROM session_vars').all() as unknown as VarRow[];
  } catch {
    return [];
  }
}

export function setVar(db: DatabaseLike, id: string, value: unknown): void {
  setGlobalVar(db, id, value);
}
