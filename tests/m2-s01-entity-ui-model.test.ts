// @vitest-environment node
// M2-S01: Entity UI model types and service adapter.
// Tests DTO → UI model mapping and service boundary.
// See: https://github.com/Djimon/WorldBrain/issues/22

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');
const openDatabases: DatabaseSync[] = [];

async function getEntityService() {
  const module = await import('../src/services/entity-service');
  return module;
}

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

function createDatabase() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  openDatabases.push(db);
  return { db, asyncDb: makeAsyncDb(db) };
}

afterEach(() => {
  while (openDatabases.length > 0) openDatabases.pop()?.close();
});

function insertEntityType(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const et = {
    id: 'entity-type-character',
    name: 'Character',
    title: 'Character',
    schema_version: '1.0.0',
    schema_json: JSON.stringify({ role: { type: 'string' } }),
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
  db.prepare(
    'INSERT INTO base_entity_types (id, name, title, schema_version, schema_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).run(et.id, et.name, et.title, et.schema_version, et.schema_json, et.created_at, et.updated_at);
}

function insertBaseEntity(db: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const e = {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist.',
    aliases_json: JSON.stringify(['The Red Notary']),
    properties_json: JSON.stringify({ role: 'archivist' }),
    body_json: JSON.stringify({ format: 'portable_blocks_v1', blocks: [] }),
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
  db.prepare(
    'INSERT INTO base_entities (id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(e.id, e.type, e.title, e.summary, e.aliases_json, e.properties_json, e.body_json, e.visibility, e.created_at, e.updated_at);
}

function insertSecondEntity(db: DatabaseSync) {
  db.prepare(
    'INSERT INTO base_entities (id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run('character-bram', 'Character', 'Bram Holt', '', '[]', '{}', '{"format":"portable_blocks_v1","blocks":[]}', 'public', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');
}

describe('M2-S01 entity UI model and service adapter', () => {
  describe('getEffectiveEntity', () => {
    it('maps SQLite DTO to UI-ready Entity model with parsed fields', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      const { getEffectiveEntity } = await getEntityService();

      const result = await getEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      if (!result.found) return;

      const entity = result.entity;
      expect(entity.id).toBe('character-ada');
      expect(entity.type).toBe('Character');
      expect(entity.title).toBe('Ada Thorn');
      expect(entity.summary).toBe('Archivist.');
      expect(entity.aliases).toEqual(['The Red Notary']);
      expect(entity.properties).toEqual({ role: 'archivist' });
      expect(entity.body).toEqual({ format: 'portable_blocks_v1', blocks: [] });
      expect(entity.visibility).toBe('public');
    });

    it('returns found: false with reason when entity does not exist', async () => {
      const { asyncDb } = createDatabase();
      const { getEffectiveEntity } = await getEntityService();

      const result = await getEffectiveEntity({ database: asyncDb, entityId: 'does-not-exist' });

      expect(result.found).toBe(false);
      if (result.found) return;
      expect(result.entityId).toBe('does-not-exist');
      expect(result.reason).toBe('base_entity_missing');
    });

    it('exposes overriddenFields so UI can highlight campaign-patched values', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      db.prepare(
        'INSERT INTO campaign_entity_overrides (entity_id, patch_json, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ).run('character-ada', JSON.stringify({ title: 'Lady Thorn' }), '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');
      const { getEffectiveEntity } = await getEntityService();

      const result = await getEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(result.overriddenFields).toContain('title');
      expect(result.entity.title).toBe('Lady Thorn');
    });
  });

  describe('listEntitiesByType', () => {
    it('returns all entities of the given type, sorted by title', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      insertSecondEntity(db);
      const { listEntitiesByType } = await getEntityService();

      const list = await listEntitiesByType({ database: asyncDb, type: 'Character' });

      expect(list).toHaveLength(2);
      expect(list[0].id).toBe('character-ada');
      expect(list[1].id).toBe('character-bram');
      expect(list.map((e) => e.title)).toEqual(['Ada Thorn', 'Bram Holt']);
    });

    it('returns an empty list when no entities of that type exist', async () => {
      const { asyncDb } = createDatabase();
      const { listEntitiesByType } = await getEntityService();

      const list = await listEntitiesByType({ database: asyncDb, type: 'Location' });

      expect(list).toEqual([]);
    });

    it('each list entry contains id, type, title, and summary', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      const { listEntitiesByType } = await getEntityService();

      const list = await listEntitiesByType({ database: asyncDb, type: 'Character' });

      expect(list[0]).toMatchObject({
        id: 'character-ada',
        type: 'Character',
        title: 'Ada Thorn',
        summary: 'Archivist.',
      });
    });
  });

  describe('UI model shape — separate from SQLite DTO', () => {
    it('entity UI model has aliases as string array, not JSON string', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      const { getEffectiveEntity } = await getEntityService();

      const result = await getEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(Array.isArray(result.entity.aliases)).toBe(true);
      expect(typeof result.entity.aliases[0]).toBe('string');
    });

    it('entity UI model has properties as object, not JSON string', async () => {
      const { db, asyncDb } = createDatabase();
      insertEntityType(db);
      insertBaseEntity(db);
      const { getEffectiveEntity } = await getEntityService();

      const result = await getEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      if (!result.found) return;
      expect(typeof result.entity.properties).toBe('object');
      expect(Array.isArray(result.entity.properties)).toBe(false);
    });
  });
});
