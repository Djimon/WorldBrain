// @vitest-environment node
// M4-S02: Session variable system — typed vars, global/session scope, setVar logs.
// See: https://github.com/Djimon/WorldBrain/issues/50

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function openDb() {
  const { applySessionSchema } = await import('../core_data/session-schema');
  const db = new DatabaseSync(':memory:');
  applySessionSchema(db);
  db.prepare(`INSERT INTO sessions (id, title, created_at) VALUES ('s1', 'Test Session', '2026-06-24')`).run();
  return db;
}

async function getService() {
  return import('../src/services/session-variable-service');
}

describe('M4-S02 session variable system', () => {
  describe('variable types', () => {
    it('supports boolean variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-bool', type: 'boolean', label: 'Is Night', value: true });
      const v = getVar(db, 's1', 'v-bool');
      expect(v?.value).toBe(true);
    });

    it('supports number variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-num', type: 'number', label: 'Round', value: 3 });
      expect(getVar(db, 's1', 'v-num')?.value).toBe(3);
    });

    it('supports enum variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-enum', type: 'enum', label: 'Phase', value: 'combat' });
      expect(getVar(db, 's1', 'v-enum')?.value).toBe('combat');
    });

    it('supports timer variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-timer', type: 'timer', label: 'Countdown', value: 5 });
      expect(getVar(db, 's1', 'v-timer')?.type).toBe('timer');
    });

    it('supports relation (entity ref) variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-rel', type: 'relation', label: 'Target', value: 'char-ada' });
      expect(getVar(db, 's1', 'v-rel')?.value).toBe('char-ada');
    });

    it('supports check_result variable type', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v-check', type: 'check_result', label: 'Stealth', value: 'success' });
      expect(getVar(db, 's1', 'v-check')?.type).toBe('check_result');
    });
  });

  describe('getVar / setVar / resetVar', () => {
    it('getVar returns null for unknown variable', async () => {
      const { getVar } = await getService();
      const db = await openDb();
      expect(getVar(db, 's1', 'nonexistent')).toBeNull();
    });

    it('setVar updates an existing variable value', async () => {
      const { setVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v1', type: 'number', label: 'Score', value: 10 });
      setVar(db, 's1', { id: 'v1', type: 'number', label: 'Score', value: 20 });
      expect(getVar(db, 's1', 'v1')?.value).toBe(20);
    });

    it('resetVar restores the default value', async () => {
      const { setVar, resetVar, getVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'v2', type: 'number', label: 'HP', value: 5, default_value: 10 });
      setVar(db, 's1', { id: 'v2', type: 'number', label: 'HP', value: 3 });
      resetVar(db, 's1', 'v2');
      expect(getVar(db, 's1', 'v2')?.value).toBe(10);
    });
  });

  describe('listVars', () => {
    it('listVars returns all session variables', async () => {
      const { setVar, listVars } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'va', type: 'boolean', label: 'A', value: true });
      setVar(db, 's1', { id: 'vb', type: 'number', label: 'B', value: 1 });
      const vars = listVars(db, 's1');
      expect(vars.length).toBe(2);
    });

    it('listVars is scoped to the session', async () => {
      const { setVar, listVars } = await getService();
      const db = await openDb();
      db.prepare(`INSERT INTO sessions (id, title, created_at) VALUES ('s2', 'Other', '2026-06-24')`).run();
      setVar(db, 's1', { id: 'vx', type: 'boolean', label: 'X', value: false });
      setVar(db, 's2', { id: 'vy', type: 'boolean', label: 'Y', value: true });
      expect(listVars(db, 's1').length).toBe(1);
      expect(listVars(db, 's2').length).toBe(1);
    });
  });

  describe('setVar writes to session_log', () => {
    it('setVar appends a var_set entry to session_log', async () => {
      const { setVar } = await getService();
      const db = await openDb();
      setVar(db, 's1', { id: 'vlog', type: 'number', label: 'Count', value: 1 });
      const log = db.prepare(`SELECT * FROM session_log WHERE session_id = 's1'`).all() as Array<{ action_type: string }>;
      expect(log.some(l => l.action_type === 'var_set')).toBe(true);
    });
  });

  describe('global variables', () => {
    it('getGlobalVar / setGlobalVar exist', async () => {
      const mod = await getService();
      expect(typeof (mod as Record<string, unknown>).setGlobalVar).toBe('function');
      expect(typeof (mod as Record<string, unknown>).getGlobalVar).toBe('function');
    });

    it('global variables persist independently of session', async () => {
      const { setGlobalVar, getGlobalVar } = await getService() as Record<string, (db: unknown, ...args: unknown[]) => unknown>;
      const db = await openDb();
      setGlobalVar(db, { id: 'gv1', type: 'boolean', label: 'Global Flag', value: true });
      expect((getGlobalVar(db, 'gv1') as Record<string, unknown>)?.value).toBe(true);
    });
  });
});
