// @vitest-environment node
// M4-S06: Session undo (Back button) — reverts last session_log action.
// See: https://github.com/Djimon/WorldBrain/issues/54

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function openDb() {
  const { applySessionSchema } = await import('../core_data/session-schema');
  const raw = new DatabaseSync(':memory:');
  applySessionSchema(raw);
  raw.prepare(`INSERT INTO sessions (id, title, created_at) VALUES ('s1', 'Test', '2026-06-24')`).run();
  // Async DatabaseLike wrapper around the sync handle; `prepare` passthrough
  // keeps the raw session_log assertions working.
  return {
    execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
    select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
      raw.prepare(sql).all(...(args as never[])) as T[],
    prepare: (sql: string) => raw.prepare(sql),
  };
}

async function getUndoService() {
  return import('../src/services/session-undo-service');
}

describe('M4-S06 session undo', () => {
  describe('undoLastAction export', () => {
    it('exports undoLastAction function', async () => {
      const mod = await getUndoService();
      expect(typeof mod.undoLastAction).toBe('function');
    });

    it('exports canUndo function', async () => {
      const mod = await getUndoService();
      expect(typeof mod.canUndo).toBe('function');
    });
  });

  describe('canUndo', () => {
    it('canUndo returns false when session_log is empty', async () => {
      const { canUndo } = await getUndoService();
      const db = await openDb();
      expect(await canUndo(db, 's1')).toBe(false);
    });

    it('canUndo returns true when session_log has entries', async () => {
      const { canUndo } = await getUndoService();
      const { setVar } = await import('../src/services/session-variable-service');
      const db = await openDb();
      await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 10 });
      expect(await canUndo(db, 's1')).toBe(true);
    });
  });

  describe('undoLastAction — variable changes', () => {
    it('undoes a var_set by restoring the previous value', async () => {
      const { undoLastAction } = await getUndoService();
      const { setVar, getVar } = await import('../src/services/session-variable-service');
      const db = await openDb();

      await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 10 });
      await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 5 });

      await undoLastAction(db, 's1');

      expect((await getVar(db, 's1', 'v1'))?.value).toBe(10);
    });

    it('undo itself is logged to session_log', async () => {
      const { undoLastAction } = await getUndoService();
      const { setVar } = await import('../src/services/session-variable-service');
      const db = await openDb();

      await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 10 });
      const logCountBefore = (db.prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = 's1'`).get() as { cnt: number }).cnt;

      await undoLastAction(db, 's1');

      const logCountAfter = (db.prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = 's1'`).get() as { cnt: number }).cnt;
      expect(logCountAfter).toBeGreaterThan(logCountBefore);
    });

    it('undoLastAction does nothing when log is empty', async () => {
      const { undoLastAction } = await getUndoService();
      const db = await openDb();
      await expect(undoLastAction(db, 's1')).resolves.toBeUndefined();
    });
  });

  describe('undoable action types', () => {
    it('var_set is undoable', async () => {
      const { undoLastAction } = await getUndoService();
      const { setVar, getVar } = await import('../src/services/session-variable-service');
      const db = await openDb();

      await setVar(db, 's1', { id: 'vundo', type: 'boolean', label: 'Flag', value: true });
      await setVar(db, 's1', { id: 'vundo', type: 'boolean', label: 'Flag', value: false });
      await undoLastAction(db, 's1');

      expect((await getVar(db, 's1', 'vundo'))?.value).toBe(true);
    });
  });
});

// Bug #118 — Finding 1: canUndo/undoLastAction must not hardcode action_type = 'var_set'
//            Finding 2: resetVar must insert a session_log row so it is undoable
describe('issue #118: session undo — resetVar logged, future action types not silently non-undoable', () => {
  it('resetVar inserts a session_log entry', async () => {
    const { setVar, resetVar } = await import('../src/services/session-variable-service');
    const db = await openDb();

    await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 42 });
    const countBefore = (db.prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = 's1'`).get() as { cnt: number }).cnt;

    await resetVar(db, 's1', 'v1');

    const countAfter = (db.prepare(`SELECT COUNT(*) as cnt FROM session_log WHERE session_id = 's1'`).get() as { cnt: number }).cnt;
    expect(countAfter).toBeGreaterThan(countBefore);
  });

  it('resetVar log entry has action_type "var_reset"', async () => {
    const { setVar, resetVar } = await import('../src/services/session-variable-service');
    const db = await openDb();

    await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 42 });
    await resetVar(db, 's1', 'v1');

    const entry = db.prepare(
      `SELECT action_type, prev_value FROM session_log WHERE session_id = 's1' AND action_type = 'var_reset' ORDER BY id DESC LIMIT 1`
    ).get() as { action_type: string; prev_value: string } | undefined;

    expect(entry).toBeDefined();
    expect(entry?.action_type).toBe('var_reset');
  });

  it('resetVar log entry stores the previous value so undo can restore it', async () => {
    const { setVar, resetVar } = await import('../src/services/session-variable-service');
    const db = await openDb();

    await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 42 });
    await resetVar(db, 's1', 'v1');

    const entry = db.prepare(
      `SELECT prev_value FROM session_log WHERE session_id = 's1' AND action_type = 'var_reset' ORDER BY id DESC LIMIT 1`
    ).get() as { prev_value: string } | undefined;

    // prev_value must capture 42 (or its JSON-serialized form) so undo can restore it
    expect(entry?.prev_value).toBeDefined();
    expect(String(entry?.prev_value)).toMatch(/42/);
  });

  it('canUndo returns true after resetVar (not limited to var_set)', async () => {
    const { canUndo } = await getUndoService();
    const { setVar, resetVar } = await import('../src/services/session-variable-service');
    const db = await openDb();

    await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 42 });
    await resetVar(db, 's1', 'v1');

    // canUndo must see var_reset entries, not just var_set
    expect(await canUndo(db, 's1')).toBe(true);
  });

  it('undoLastAction can undo a var_reset by restoring the previous value', async () => {
    const { undoLastAction } = await getUndoService();
    const { setVar, resetVar, getVar } = await import('../src/services/session-variable-service');
    const db = await openDb();

    await setVar(db, 's1', { id: 'v1', type: 'number', label: 'HP', value: 42 });
    await resetVar(db, 's1', 'v1');
    await undoLastAction(db, 's1');

    expect((await getVar(db, 's1', 'v1'))?.value).toBe(42);
  });

  it('canUndo query does not filter on a single hardcoded action_type', async () => {
    // Inserting a hypothetical future action_type must still be seen by canUndo
    const { canUndo } = await getUndoService();
    const db = await openDb();

    db.prepare(
      `INSERT INTO session_log (id, session_id, action_type, payload_json, created_at)
       VALUES ('log-future-1', 's1', 'entity_created', '{"id":"ent-1"}', '2026-06-24T00:00:00.000Z')`
    ).run();

    // canUndo must return true — the hardcoded var_set filter would miss this row
    expect(await canUndo(db, 's1')).toBe(true);
  });
});
