// @vitest-environment node
// M2-S08: Define relations SQLite schema and campaign log.
// See: https://github.com/Djimon/WorldBrain/issues/36

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getApplyRelationsSchema() {
  const mod = await import('../core_data/relations-schema');
  return mod.applyRelationsSchema;
}

// Async DatabaseLike wrapper around the sync in-memory node:sqlite handle,
// plus a `prepare` passthrough so the raw PRAGMA/INSERT assertions keep working.
function openMemoryDb() {
  const raw = new DatabaseSync(':memory:');
  return {
    execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
    select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
      raw.prepare(sql).all(...(args as never[])) as T[],
    prepare: (sql: string) => raw.prepare(sql),
  };
}

describe('M2-S08 relations SQLite schema', () => {
  describe('relations table structure', () => {
    it('creates a relations table without throwing', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await expect(applyRelationsSchema(db)).resolves.toBeUndefined();
    });

    it('relations table has all required columns', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      const cols = db.prepare('PRAGMA table_info(relations)').all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);

      expect(names).toContain('id');
      expect(names).toContain('source_id');
      expect(names).toContain('target_id');
      expect(names).toContain('relation_type');
      expect(names).toContain('inverse_type');
      expect(names).toContain('active');
      expect(names).toContain('visibility_json');
      expect(names).toContain('notes');
      expect(names).toContain('created_in_session');
      expect(names).toContain('deactivated_in_session');
      expect(names).toContain('created_at');
      expect(names).toContain('updated_at');
    });

    it('active column defaults to 1 (true)', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      db.prepare(
        `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, visibility_json)
         VALUES ('r1', 'e1', 'e2', 'ally_of', 'ally_of', '"public"')`,
      ).run();

      const row = db.prepare('SELECT active FROM relations WHERE id = ?').get('r1') as { active: number };
      expect(row.active).toBe(1);
    });

    it('notes column is nullable', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      expect(() =>
        db.prepare(
          `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, visibility_json)
           VALUES ('r2', 'e1', 'e2', 'ally_of', 'ally_of', '"public"')`,
        ).run(),
      ).not.toThrow();
    });
  });

  describe('campaign_relation_log table structure', () => {
    it('creates campaign_relation_log table', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      const cols = db.prepare('PRAGMA table_info(campaign_relation_log)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('campaign_relation_log has all required columns', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      const cols = db.prepare('PRAGMA table_info(campaign_relation_log)').all() as Array<{ name: string }>;
      const names = cols.map((c) => c.name);

      expect(names).toContain('id');
      expect(names).toContain('relation_id');
      expect(names).toContain('event');
      expect(names).toContain('session_id');
      expect(names).toContain('timestamp');
    });

    it('session_id column in campaign_relation_log is nullable', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      db.prepare(
        `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, visibility_json)
         VALUES ('r3', 'e1', 'e2', 'ally_of', 'ally_of', '"public"')`,
      ).run();

      expect(() =>
        db.prepare(
          `INSERT INTO campaign_relation_log (id, relation_id, event, timestamp)
           VALUES ('log1', 'r3', 'added', '2026-06-24T00:00:00Z')`,
        ).run(),
      ).not.toThrow();
    });
  });

  describe('idempotency', () => {
    it('applying the schema twice does not throw', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();

      await applyRelationsSchema(db);
      await expect(applyRelationsSchema(db)).resolves.toBeUndefined();
    });

    it('existing relations rows are preserved on second schema application', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      db.prepare(
        `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, visibility_json)
         VALUES ('r4', 'e1', 'e2', 'knows_secret', 'secret_known_by', '"public"')`,
      ).run();

      await applyRelationsSchema(db);

      const rows = db.prepare('SELECT * FROM relations').all() as unknown[];
      expect(rows.length).toBe(1);
    });
  });

  describe('prefix convention', () => {
    it('relation log table uses campaign_ prefix for durable data', async () => {
      const applyRelationsSchema = await getApplyRelationsSchema();
      const db = openMemoryDb();
      await applyRelationsSchema(db);

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
        .all() as Array<{ name: string }>;
      const names = tables.map((t) => t.name);

      const campaignTable = names.find((n) => n.startsWith('campaign_') && n.includes('relation'));
      expect(campaignTable).toBeDefined();
    });
  });
});
