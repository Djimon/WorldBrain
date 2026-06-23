// @vitest-environment node

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

type ReadEffectiveEntityInput = {
  database: DatabaseSync;
  entityId: string;
  projectRoot?: string;
};

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');
const temporaryRoots: string[] = [];

async function readEffectiveEntity(input: ReadEffectiveEntityInput) {
  const module = await import('../src/data/effective-entity');

  return module.readEffectiveEntity(input);
}

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(runtimeSchemaSql);

  return database;
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

describe('M1-S06 effective entity read model', () => {
  it('reads a base entity by ID from SQLite without campaign overrides', async () => {
    const database = createDatabase();
    insertBaseEntity(database);

    try {
      const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

      expect(result).toEqual({
        found: true,
        entityId: 'character-ada',
        entity: baseEntityRecord(),
        baseEntity: baseEntityRecord(),
        overriddenFields: [],
        orphanedOverrideCount: 0,
      });
    } finally {
      database.close();
    }
  });

  it('applies supported campaign overrides while keeping the base table row unchanged', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    const baseRowBeforeOverride = readBaseRow(database, 'character-ada');
    insertCampaignOverride(database, 'character-ada', {
      summary: 'Known to the party as the Red Notary.',
      properties: {
        status: 'revealed',
      },
    });

    try {
      const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

      expect(result.found).toBe(true);
      expect(result.entity).toEqual({
        ...baseEntityRecord(),
        summary: 'Known to the party as the Red Notary.',
        properties: {
          role: 'archivist',
          status: 'revealed',
        },
      });
      expect(result.baseEntity).toEqual(baseEntityRecord());
      expect(result.overriddenFields).toEqual(['properties.status', 'summary']);
      expect(readBaseRow(database, 'character-ada')).toEqual(baseRowBeforeOverride);
    } finally {
      database.close();
    }
  });

  it('does not modify base JSON files during effective read behavior', async () => {
    const database = createDatabase();
    const { projectRoot, entityPath } = createSourceProjectFile();
    const sourceBeforeRead = readFileSync(entityPath, 'utf8');
    insertBaseEntity(database);
    insertCampaignOverride(database, 'character-ada', {
      title: 'Campaign-only alias',
    });

    try {
      await readEffectiveEntity({ database, entityId: 'character-ada', projectRoot });

      expect(readFileSync(entityPath, 'utf8')).toBe(sourceBeforeRead);
    } finally {
      database.close();
    }
  });

  it('returns an explicit missing-base result when no base entity exists for the requested ID', async () => {
    const database = createDatabase();

    try {
      const result = await readEffectiveEntity({ database, entityId: 'missing-entity' });

      expect(result).toEqual({
        found: false,
        entityId: 'missing-entity',
        reason: 'base_entity_missing',
        orphanedOverrideCount: 0,
      });
    } finally {
      database.close();
    }
  });

  it('reports orphaned campaign overrides without synthesizing an entity', async () => {
    const database = createDatabase();
    insertCampaignOverride(database, 'orphaned-entity', {
      summary: 'This override has no imported base row.',
    });

    try {
      const result = await readEffectiveEntity({ database, entityId: 'orphaned-entity' });

      expect(result).toEqual({
        found: false,
        entityId: 'orphaned-entity',
        reason: 'base_entity_missing',
        orphanedOverrideCount: 1,
      });
    } finally {
      database.close();
    }
  });
});
