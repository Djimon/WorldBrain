// @vitest-environment node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

type ImportBaseJsonProjectInput = {
  database: DatabaseSync;
  projectRoot: string;
};

const temporaryRoots: string[] = [];
const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

async function importBaseJsonProject(input: ImportBaseJsonProjectInput) {
  // Import directly from core_data/ — Node-environment tests must not go through src/data/,
  // which is the Vite renderer boundary (issue #21).
  const module = await import('../core_data/base-json-import');

  return module.importBaseJsonProject(input);
}

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(runtimeSchemaSql);

  return database;
}

function createTemporaryProjectRoot() {
  const projectRoot = mkdtempSync(join(tmpdir(), 'worldbuilderx-base-import-'));
  temporaryRoots.push(projectRoot);

  return projectRoot;
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(new URL('.', `file:///${filePath.replaceAll('\\', '/')}`), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeValidProject(projectRoot: string) {
  await writeJson(join(projectRoot, 'project.json'), {
    id: 'project-emberfall',
    title: 'Emberfall',
    schema_version: '1.0.0',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  });
  await writeJson(join(projectRoot, 'entity-types', 'character.json'), {
    id: 'entity-type-character',
    name: 'Character',
    title: 'Character',
    schema_version: '1.0.0',
    properties: {},
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  });
  await writeJson(join(projectRoot, 'entities', 'Character', 'character-ada.json'), validEntity());
}

function validEntity() {
  return {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: ['The Red Notary'],
    properties: {
      role: 'archivist',
    },
    body: {
      format: 'portable_blocks_v1',
      blocks: [],
    },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };
}

function selectRows(database: DatabaseSync, tableName: string) {
  return database.prepare(`SELECT * FROM ${tableName} ORDER BY id`).all();
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const projectRoot = temporaryRoots.pop();

    if (projectRoot !== undefined && existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  }
});

describe('M1-S05 base JSON import pipeline', () => {
  it('imports one valid entity type and one valid base entity into an empty runtime database', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProject(projectRoot);

    try {
      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result).toEqual({
        blocked: false,
        imported: {
          entityTypes: 1,
          entities: 1,
        },
        errors: [],
      });
      expect(selectRows(database, 'base_entity_types')).toEqual([
        expect.objectContaining({
          id: 'entity-type-character',
          name: 'Character',
          title: 'Character',
        }),
      ]);
      expect(selectRows(database, 'base_entities')).toEqual([
        expect.objectContaining({
          id: 'character-ada',
          type: 'Character',
          title: 'Ada Thorn',
          aliases_json: JSON.stringify(['The Red Notary']),
          properties_json: JSON.stringify({ role: 'archivist' }),
          body_json: JSON.stringify({ format: 'portable_blocks_v1', blocks: [] }),
        }),
      ]);
    } finally {
      database.close();
    }
  });

  it('rebuilds base rows on re-import while preserving campaign rows', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProject(projectRoot);

    try {
      await importBaseJsonProject({ database, projectRoot });
      database
        .prepare(
          [
            'INSERT INTO campaign_notes',
            '(id, entity_id, note_text, created_at, updated_at)',
            'VALUES (?, ?, ?, ?, ?)',
          ].join(' '),
        )
        .run('note-1', 'character-ada', 'Met during session three.', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');
      database
        .prepare(
          [
            'INSERT INTO base_entities',
            '(id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)',
            'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          ].join(' '),
        )
        .run('obsolete-entity', 'Character', 'Obsolete', '', '[]', '{}', '{"format":"portable_blocks_v1","blocks":[]}', 'public', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');

      await importBaseJsonProject({ database, projectRoot });

      expect(selectRows(database, 'base_entities').map((row) => row.id)).toEqual(['character-ada']);
      expect(selectRows(database, 'campaign_notes')).toEqual([
        expect.objectContaining({
          id: 'note-1',
          entity_id: 'character-ada',
          note_text: 'Met during session three.',
        }),
      ]);
    } finally {
      database.close();
    }
  });

  it('skips an invalid base entity and reports a structured validation error', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProject(projectRoot);
    await writeJson(join(projectRoot, 'entities', 'Character', 'broken.json'), {
      id: 'character-broken',
      type: 'Character',
      summary: 'Missing title.',
    });

    try {
      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result.blocked).toBe(false);
      expect(result.imported).toEqual({
        entityTypes: 1,
        entities: 1,
      });
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: expect.stringMatching(/entities[\\/]Character[\\/]broken\.json/u),
          documentKind: 'base_entity',
          severity: 'error',
        }),
      );
      expect(selectRows(database, 'base_entities').map((row) => row.id)).toEqual(['character-ada']);
    } finally {
      database.close();
    }
  });

  it('is deterministic for stable input files and does not mutate source JSON', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProject(projectRoot);
    const entityPath = join(projectRoot, 'entities', 'Character', 'character-ada.json');
    const sourceBeforeImport = readFileSync(entityPath, 'utf8');

    try {
      const firstResult = await importBaseJsonProject({ database, projectRoot });
      const firstEntityRows = selectRows(database, 'base_entities');
      const firstEntityTypeRows = selectRows(database, 'base_entity_types');

      const secondResult = await importBaseJsonProject({ database, projectRoot });

      expect(secondResult).toEqual(firstResult);
      expect(selectRows(database, 'base_entities')).toEqual(firstEntityRows);
      expect(selectRows(database, 'base_entity_types')).toEqual(firstEntityTypeRows);
      expect(readFileSync(entityPath, 'utf8')).toBe(sourceBeforeImport);
    } finally {
      database.close();
    }
  });
});
