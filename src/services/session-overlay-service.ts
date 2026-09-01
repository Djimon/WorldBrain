// M13-S04 (#239): House-rule overlay activation per session (EPIC-019).
// Module definitions (M13-S01) are reusable; their activation is
// session-local. Order via `display_order` (smallest first).
import type { DatabaseLike } from './entity-service';

export interface ActiveOverlay {
  moduleId: string;
  order: number;
  enabled: boolean;
}

export interface ActivateParams {
  sessionId: string;
  moduleId: string;
  order?: number;
  enabled?: boolean;
}

export async function activateModule(db: DatabaseLike, params: ActivateParams): Promise<void> {
  const order = params.order ?? 0;
  const enabled = (params.enabled ?? true) ? 1 : 0;
  // Upsert by PRIMARY KEY (session_id, module_id) — activating multiple times
  // reorders / re-enables, without creating duplicates.
  await db.execute(
    `INSERT INTO session_active_overlays (session_id, module_id, display_order, enabled)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(session_id, module_id) DO UPDATE SET
       display_order = excluded.display_order,
       enabled = excluded.enabled`,
    [params.sessionId, params.moduleId, order, enabled],
  );
}

export interface DeactivateParams {
  sessionId: string;
  moduleId: string;
}

export async function deactivateModule(db: DatabaseLike, params: DeactivateParams): Promise<void> {
  await db.execute(
    'DELETE FROM session_active_overlays WHERE session_id = ? AND module_id = ?',
    [params.sessionId, params.moduleId],
  );
}

interface RawRow { module_id: string; display_order: number; enabled: number }

export async function listActiveModules(db: DatabaseLike, sessionId: string): Promise<ActiveOverlay[]> {
  const rows = await db.select<RawRow>(
    `SELECT module_id, display_order, enabled
     FROM session_active_overlays
     WHERE session_id = ?
     ORDER BY display_order, module_id`,
    [sessionId],
  );
  return rows.map((r) => ({ moduleId: r.module_id, order: r.display_order, enabled: r.enabled === 1 }));
}

export interface ReorderParams {
  sessionId: string;
  moduleIds: readonly string[];
}

/** Sets the order of the active overlays to the given order —
 *  the index in `moduleIds` is the new `display_order`. Modules not named
 *  stay unchanged (test expectation + intuitive behavior). */
export async function reorderModules(db: DatabaseLike, params: ReorderParams): Promise<void> {
  for (let i = 0; i < params.moduleIds.length; i += 1) {
    await db.execute(
      'UPDATE session_active_overlays SET display_order = ? WHERE session_id = ? AND module_id = ?',
      [i, params.sessionId, params.moduleIds[i]],
    );
  }
}

// M13-S05 (#240): Ad-hoc session override — implicit session-local
// "session module" layer. Uses the SAME entry form as the module library
// (S01/S07), so no parallel path arises.
export interface OverlayEntry {
  target: string;
  op: string;
  value: unknown;
}

export interface AddSessionOverrideParams {
  sessionId: string;
  entry: OverlayEntry;
}

export async function addSessionOverride(db: DatabaseLike, params: AddSessionOverrideParams): Promise<{ id: string }> {
  const id = `sao_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO session_ad_hoc_overrides (id, session_id, target, op, value_json) VALUES (?, ?, ?, ?, ?)',
    [id, params.sessionId, params.entry.target, params.entry.op, JSON.stringify(params.entry.value)],
  );
  return { id };
}

interface RawOverrideRow { id: string; target: string; op: string; value_json: string }

export interface SessionOverride extends OverlayEntry { id: string }

export async function listSessionOverrides(db: DatabaseLike, sessionId: string): Promise<SessionOverride[]> {
  const rows = await db.select<RawOverrideRow>(
    'SELECT id, target, op, value_json FROM session_ad_hoc_overrides WHERE session_id = ? ORDER BY created_at',
    [sessionId],
  );
  return rows.map((r) => ({
    id: r.id,
    target: r.target,
    op: r.op,
    value: safeParse(r.value_json),
  }));
}

function safeParse(json: string): unknown {
  try { return JSON.parse(json); } catch { return null; }
}

export interface PromoteParams {
  sessionId: string;
  name: string;
  baseSystemId: string;
  description?: string;
}

export interface PromotedModule {
  id: string;
  name: string;
}

/**
 * Takes all ad-hoc overrides of the session and creates from them a named,
 * shareable rule_module (M13-S01 form) — the entries move into
 * rule_module_entries; the ad-hoc rows stay untouched, so the
 * DM can keep the session running.
 */
export async function promoteToModule(db: DatabaseLike, params: PromoteParams): Promise<PromotedModule> {
  const id = `rmod_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO rule_modules (id, name, base_system_id, description) VALUES (?, ?, ?, ?)',
    [id, params.name, params.baseSystemId, params.description ?? null],
  );
  const overrides = await listSessionOverrides(db, params.sessionId);
  for (const o of overrides) {
    const entryId = `rme_${crypto.randomUUID()}`;
    await db.execute(
      'INSERT INTO rule_module_entries (id, module_id, target, op, value_json) VALUES (?, ?, ?, ?, ?)',
      [entryId, id, o.target, o.op, JSON.stringify(o.value)],
    );
  }
  return { id, name: params.name };
}
