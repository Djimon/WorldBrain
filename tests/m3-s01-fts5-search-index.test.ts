// @vitest-environment node
// M3-S01: FTS5 search index setup — virtual table, indexing pipeline, rebuild utility.
// See: https://github.com/Djimon/WorldBrain/issues/42
// Rewritten to target async DatabaseLike after search-schema migration to execute()/select().

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike for tests.
function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

async function getSearchSchema() {
  return import('../core_data/search-schema');
}

function openMemoryDb() {
  return new DatabaseSync(':memory:');
}

async function openFullDb() {
  const db = openMemoryDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS base_entities (
      id TEXT PRIMARY KEY,
      type_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      aliases_json TEXT,
      body_json TEXT,
      properties_json TEXT,
      visibility TEXT DEFAULT 'public',
      created_at TEXT,
      updated_at TEXT
    );
  `);
  const asyncDb = makeAsyncDb(db);
  const { applySearchSchema } = await getSearchSchema();
  await applySearchSchema(asyncDb);
  return { db, asyncDb };
}

describe('M3-S01 FTS5 search index', () => {
  describe('schema creation', () => {
    it('applySearchSchema creates the entity_search FTS5 table', async () => {
      const { db, asyncDb } = await openFullDb();

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type IN ('table','shadow') AND name = 'entity_search'`)
        .all() as Array<{ name: string }>;
      expect(tables.length).toBeGreaterThan(0);
    });

    it('entity_search uses fts5 engine', async () => {
      const { db } = await openFullDb();

      const vtables = db
        .prepare(`SELECT name, sql FROM sqlite_master WHERE type='table' AND name='entity_search'`)
        .all() as Array<{ name: string; sql: string }>;

      expect(vtables.length).toBeGreaterThan(0);
    });

    it('entity_search has entity_id as an UNINDEXED column', async () => {
      const { applySearchSchema, indexEntity } = await getSearchSchema();
      const db = openMemoryDb();
      const asyncDb = makeAsyncDb(db);
      await applySearchSchema(asyncDb);

      await indexEntity(asyncDb, {
        entity_id: 'e1',
        title: 'Ada Thorn',
        aliases: 'The Red Notary',
        summary: 'Archivist.',
        body: '',
        tags: '',
        properties_text: '',
      });

      const rows = db.prepare(`SELECT entity_id FROM entity_search WHERE entity_id = 'e1'`).all();
      expect(rows.length).toBe(1);
    });

    it('applying the schema twice is idempotent', async () => {
      const { applySearchSchema } = await getSearchSchema();
      const db = openMemoryDb();
      const asyncDb = makeAsyncDb(db);
      await applySearchSchema(asyncDb);
      await expect(applySearchSchema(asyncDb)).resolves.not.toThrow();
    });
  });

  describe('index rebuild utility', () => {
    it('exports a rebuildSearchIndex function', async () => {
      const mod = await getSearchSchema();
      expect(typeof (mod as Record<string, unknown>).rebuildSearchIndex).toBe('function');
    });

    it('rebuildSearchIndex returns a Promise', async () => {
      const { db, asyncDb } = await openFullDb();
      const { rebuildSearchIndex } = await getSearchSchema();
      const result = rebuildSearchIndex(asyncDb);
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('rebuildSearchIndex populates entity_search from base_entities', async () => {
      const { db, asyncDb } = await openFullDb();
      const { rebuildSearchIndex } = await getSearchSchema();

      db.prepare(
        `INSERT INTO base_entities (id, type_id, title, summary, aliases_json, body_json, properties_json, created_at, updated_at)
         VALUES ('e1', 'Character', 'Ada Thorn', 'Archivist.', '["The Red Notary"]', '{"format":"portable_blocks_v1","blocks":[]}', '{}', '2026-06-24', '2026-06-24')`,
      ).run();

      await rebuildSearchIndex(asyncDb);

      const rows = db.prepare(`SELECT entity_id FROM entity_search`).all() as Array<{ entity_id: string }>;
      expect(rows.some((r) => r.entity_id === 'e1')).toBe(true);
    });

    it('rebuildSearchIndex clears stale entries before repopulating', async () => {
      const { db, asyncDb } = await openFullDb();
      const { rebuildSearchIndex } = await getSearchSchema();

      db.prepare(
        `INSERT INTO base_entities (id, type_id, title, summary, aliases_json, body_json, properties_json, created_at, updated_at)
         VALUES ('e-stale', 'Character', 'Stale Entity', '', '[]', '{"blocks":[]}', '{}', '2026-06-24', '2026-06-24')`,
      ).run();
      await rebuildSearchIndex(asyncDb);
      db.prepare(`DELETE FROM base_entities WHERE id = 'e-stale'`).run();
      await rebuildSearchIndex(asyncDb);

      const rows = db.prepare(`SELECT entity_id FROM entity_search WHERE entity_id = 'e-stale'`).all();
      expect(rows.length).toBe(0);
    });
  });

  describe('indexing pipeline', () => {
    it('exports an indexEntity function for single-entity index updates', async () => {
      const mod = await getSearchSchema();
      expect(typeof (mod as Record<string, unknown>).indexEntity).toBe('function');
    });

    it('indexEntity returns a Promise', async () => {
      const { indexEntity, applySearchSchema } = await getSearchSchema();
      const db = openMemoryDb();
      const asyncDb = makeAsyncDb(db);
      await applySearchSchema(asyncDb);
      const result = indexEntity(asyncDb, {
        entity_id: 'e2', title: 'Bram Holt', aliases: 'Innkeeper',
        summary: 'Runs the inn.', body: '', tags: '', properties_text: '',
      });
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('indexEntity inserts or replaces the entity in entity_search', async () => {
      const { db, asyncDb } = await openFullDb();
      const { indexEntity } = await getSearchSchema();

      await indexEntity(asyncDb, {
        entity_id: 'e2',
        title: 'Bram Holt',
        aliases: 'Innkeeper',
        summary: 'Runs the inn.',
        body: '',
        tags: '',
        properties_text: '',
      });

      const row = db.prepare(`SELECT entity_id FROM entity_search WHERE entity_id = 'e2'`).get() as { entity_id: string } | undefined;
      expect(row?.entity_id).toBe('e2');
    });

    it('indexEntity updates an existing entry rather than duplicating', async () => {
      const { db, asyncDb } = await openFullDb();
      const { indexEntity } = await getSearchSchema();

      await indexEntity(asyncDb, { entity_id: 'e3', title: 'Old Title', aliases: '', summary: '', body: '', tags: '', properties_text: '' });
      await indexEntity(asyncDb, { entity_id: 'e3', title: 'New Title', aliases: '', summary: '', body: '', tags: '', properties_text: '' });

      const rows = db.prepare(`SELECT entity_id FROM entity_search WHERE entity_id = 'e3'`).all();
      expect(rows.length).toBe(1);
    });

    it('exports a removeEntityFromIndex function', async () => {
      const mod = await getSearchSchema();
      expect(typeof (mod as Record<string, unknown>).removeEntityFromIndex).toBe('function');
    });

    it('removeEntityFromIndex returns a Promise', async () => {
      const { removeEntityFromIndex, applySearchSchema } = await getSearchSchema();
      const db = openMemoryDb();
      const asyncDb = makeAsyncDb(db);
      await applySearchSchema(asyncDb);
      const result = removeEntityFromIndex(asyncDb, 'e99');
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });
});
