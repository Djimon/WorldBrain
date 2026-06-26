// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike.
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

type ReadEffectiveEntityInput = {
  database: DatabaseLike;
  entityId: string;
  projectRoot?: string;
};

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');
const temporaryRoots: string[] = [];

async function readEffectiveEntity(input: ReadEffectiveEntityInput) {
  const module = await import('../src/data/effective-entity');

  return module.readEffectiveEntity(input);
}

function createRawDb() {
  const database = new DatabaseSync(':memory:');
  database.exec(runtimeSchemaSql);
  return database;
}

function createDatabase() {
  const raw = createRawDb();
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

function baseEntityRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: ['The Red Notary'],
    properties: {
      role: 'archivist',
      status: 'unknown',
    },
    body: {
      format: 'portable_blocks_v1',
      blocks: [],
    },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
}

function insertBaseEntity(database: DatabaseSync, entity = baseEntityRecord()) {
  database
    .prepare(
      [
        'INSERT INTO base_entities',
        '(id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      entity.id,
      entity.type,
      entity.title,
      entity.summary,
      JSON.stringify(entity.aliases),
      JSON.stringify(entity.properties),
      JSON.stringify(entity.body),
      entity.visibility,
      entity.created_at,
      entity.updated_at,
    );
}

function insertCampaignOverride(database: DatabaseSync, entityId: string, patch: Record<string, unknown>) {
  database
    .prepare(
      [
        'INSERT INTO campaign_entity_overrides',
        '(id, entity_id, patch_json, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      `override-${entityId}`,
      entityId,
      JSON.stringify(patch),
      '2026-06-23T01:00:00.000Z',
      '2026-06-23T01:00:00.000Z',
    );
}

function readBaseRow(database: DatabaseSync, entityId: string) {
  return database.prepare('SELECT * FROM base_entities WHERE id = ?').get(entityId);
}

function createSourceProjectFile() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'worldbuilderx-effective-read-'));
  temporaryRoots.push(projectRoot);
  const entityPath = join(projectRoot, 'entities', 'Character', 'character-ada.json');

  mkdirSync(join(projectRoot, 'entities', 'Character'), { recursive: true });
  writeFileSync(entityPath, `${JSON.stringify(baseEntityRecord(), null, 2)}\n`, 'utf8');

  return { projectRoot, entityPath };
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const projectRoot = temporaryRoots.pop();

    if (projectRoot !== undefined) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  }
});

// Shorthand: insert a campaign override for the default test entity.
function insertOverride(db: DatabaseSync, patch: Record<string, unknown>) {
  insertCampaignOverride(db, 'character-ada', patch);
}

describe('M1-S06 effective entity read model', () => {
  it('reads a base entity by ID from SQLite without campaign overrides', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);

    try {
      const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result).toEqual({
        found: true,
        entityId: 'character-ada',
        entity: baseEntityRecord(),
        baseEntity: baseEntityRecord(),
        overriddenFields: [],
        orphanedOverrideCount: 0,
      });
    } finally {
      db.close();
    }
  });

  it('applies supported campaign overrides while keeping the base table row unchanged', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    const baseRowBeforeOverride = readBaseRow(db, 'character-ada');
    insertCampaignOverride(db, 'character-ada', {
      summary: 'Known to the party as the Red Notary.',
      properties: { status: 'revealed' },
    });

    try {
      const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      expect(result.entity).toEqual({
        ...baseEntityRecord(),
        summary: 'Known to the party as the Red Notary.',
        properties: { role: 'archivist', status: 'revealed' },
      });
      expect(result.baseEntity).toEqual(baseEntityRecord());
      expect(result.overriddenFields).toEqual(['properties.status', 'summary']);
      expect(readBaseRow(db, 'character-ada')).toEqual(baseRowBeforeOverride);
    } finally {
      db.close();
    }
  });

  it('does not modify base JSON files during effective read behavior', async () => {
    const { db, asyncDb } = createDatabase();
    const { projectRoot, entityPath } = createSourceProjectFile();
    const sourceBeforeRead = readFileSync(entityPath, 'utf8');
    insertBaseEntity(db);
    insertCampaignOverride(db, 'character-ada', { title: 'Campaign-only alias' });

    try {
      await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada', projectRoot });

      expect(readFileSync(entityPath, 'utf8')).toBe(sourceBeforeRead);
    } finally {
      db.close();
    }
  });

  it('returns an explicit missing-base result when no base entity exists for the requested ID', async () => {
    const { db, asyncDb } = createDatabase();

    try {
      const result = await readEffectiveEntity({ database: asyncDb, entityId: 'missing-entity' });

      expect(result).toEqual({
        found: false,
        entityId: 'missing-entity',
        reason: 'base_entity_missing',
        orphanedOverrideCount: 0,
      });
    } finally {
      db.close();
    }
  });

  it('reports orphaned campaign overrides without synthesizing an entity', async () => {
    const { db, asyncDb } = createDatabase();
    insertCampaignOverride(db, 'orphaned-entity', {
      summary: 'This override has no imported base row.',
    });

    try {
      const result = await readEffectiveEntity({ database: asyncDb, entityId: 'orphaned-entity' });

      expect(result).toEqual({
        found: false,
        entityId: 'orphaned-entity',
        reason: 'base_entity_missing',
        orphanedOverrideCount: 1,
      });
    } finally {
      db.close();
    }
  });
});

// Bug #20
describe('issue #20: overriddenFields accuracy', () => {
  it('does not include "body" in overriddenFields when patch contains body but body is not an applied field', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { body: { format: 'portable_blocks_v1', blocks: [{ type: 'paragraph' }] } });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).not.toContain('body');
  });

  it('only lists fields that actually changed the effective entity value', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, {
      title: 'Ada Thorn (Renamed)',
      body: { format: 'portable_blocks_v1', blocks: [] },
      unknownField: 'ignored',
    });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toContain('title');
    expect(result.overriddenFields).not.toContain('body');
    expect(result.overriddenFields).not.toContain('unknownField');
  });

  it('does not list a field as overridden when the patch value equals the base value', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { title: 'Ada Thorn' });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).not.toContain('title');
  });

  it('includes "title" in overriddenFields when patch changes the title', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { title: 'Lady Thorn' });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toContain('title');
    expect(result.entity.title).toBe('Lady Thorn');
  });

  it('includes "summary" in overriddenFields when patch changes the summary', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { summary: 'Now a fugitive.' });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toContain('summary');
    expect(result.overriddenFields).not.toContain('body');
  });

  it('includes "visibility" in overriddenFields when patch changes visibility', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { visibility: 'hidden' });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toContain('visibility');
  });

  it('includes "properties.role" in overriddenFields when a property key changes', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { properties: { role: 'fugitive' } });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toContain('properties.role');
    expect(result.overriddenFields).not.toContain('body');
  });

  it('returns an empty overriddenFields array when patch contains only unapplied fields', async () => {
    const { db, asyncDb } = createDatabase();
    insertBaseEntity(db);
    insertOverride(db, { body: { format: 'portable_blocks_v1', blocks: [] }, unknownField: 'x' });

    const result = await readEffectiveEntity({ database: asyncDb, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.overriddenFields).toEqual([]);
  });
});

