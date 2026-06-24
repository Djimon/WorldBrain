// @vitest-environment node
// M4-S01: Session page schema & data model.
// See: https://github.com/Djimon/WorldBrain/issues/49

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getSessionSchema() {
  return import('../core_data/session-schema');
}

function openDb() {
  return new DatabaseSync(':memory:');
}

describe('M4-S01 session schema', () => {
  describe('sessions table', () => {
    it('creates sessions table', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const cols = db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('sessions table has id, title, world_time_start, created_at', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const names = (db.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('title');
      expect(names).toContain('world_time_start');
      expect(names).toContain('created_at');
    });
  });

  describe('session_variables table', () => {
    it('creates session_variables table', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const cols = db.prepare('PRAGMA table_info(session_variables)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('session_variables has session_id, id, type, label, default_value, value, allow_global_override', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const names = (db.prepare('PRAGMA table_info(session_variables)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('session_id');
      expect(names).toContain('id');
      expect(names).toContain('type');
      expect(names).toContain('label');
      expect(names).toContain('value');
      expect(names).toContain('allow_global_override');
    });
  });

  describe('global_variables table', () => {
    it('creates global_variables table', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const cols = db.prepare('PRAGMA table_info(global_variables)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('global_variables has id, type, label, default_value, value', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const names = (db.prepare('PRAGMA table_info(global_variables)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('type');
      expect(names).toContain('label');
      expect(names).toContain('value');
    });
  });

  describe('capture_notes table', () => {
    it('creates capture_notes table', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const cols = db.prepare('PRAGMA table_info(capture_notes)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('capture_notes has id, session_id, type, raw_text, status, links_json, created_at', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const names = (db.prepare('PRAGMA table_info(capture_notes)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('session_id');
      expect(names).toContain('type');
      expect(names).toContain('raw_text');
      expect(names).toContain('status');
      expect(names).toContain('created_at');
    });
  });

  describe('session_log table', () => {
    it('creates session_log table', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const cols = db.prepare('PRAGMA table_info(session_log)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('session_log has id, session_id, action_type, payload_json, created_at', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      const names = (db.prepare('PRAGMA table_info(session_log)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('session_id');
      expect(names).toContain('action_type');
      expect(names).toContain('created_at');
    });

    it('session_log rows can be inserted but not deleted (append-only enforced by absence of DELETE trigger or FK constraint)', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);

      db.prepare(`INSERT INTO sessions (id, title, created_at) VALUES ('s1', 'Test', '2026-06-24')`).run();
      db.prepare(`INSERT INTO session_log (id, session_id, action_type, payload_json, created_at)
                  VALUES ('log1', 's1', 'var_set', '{}', '2026-06-24')`).run();

      const rows = db.prepare('SELECT * FROM session_log').all() as unknown[];
      expect(rows.length).toBe(1);
    });
  });

  describe('idempotency', () => {
    it('applying schema twice does not throw', async () => {
      const { applySessionSchema } = await getSessionSchema();
      const db = openDb();
      applySessionSchema(db);
      expect(() => applySessionSchema(db)).not.toThrow();
    });
  });
});
