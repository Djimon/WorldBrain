// @vitest-environment node
// Tests for issue #18: Malformed JSON files must produce structured errors, not thrown exceptions.
// See: https://github.com/Djimon/WorldBrain/issues/18

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
  const projectRoot = mkdtempSync(join(tmpdir(), 'worldbuilderx-issue18-'));
  temporaryRoots.push(projectRoot);
  return projectRoot;
}

async function writeJson(filePath: string, value: unknown) {
  await mkdir(new URL('.', `file:///${filePath.replaceAll('\\', '/')}`), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function writeRaw(filePath: string, content: string) {
  await mkdir(new URL('.', `file:///${filePath.replaceAll('\\', '/')}`), { recursive: true });
  writeFileSync(filePath, content, 'utf8');
}

async function writeValidProjectBase(projectRoot: string) {
  await writeJson(join(projectRoot, 'project.json'), {
    id: 'project-issue18',
    title: 'Issue 18 Project',
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
  await writeJson(join(projectRoot, 'entities', 'Character', 'character-ada.json'), {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: [],
    properties: {},
    body: { format: 'portable_blocks_v1', blocks: [] },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  });
}

afterEach(() => {
  while (temporaryRoots.length > 0) {
    const projectRoot = temporaryRoots.pop();
    if (projectRoot !== undefined && existsSync(projectRoot)) {
      rmSync(projectRoot, { recursive: true, force: true });
    }
  }
});

describe('issue #18: malformed JSON files produce structured errors', () => {
  it('returns a blocking structured error when project.json contains invalid JSON', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);
    await writeRaw(join(projectRoot, 'project.json'), '{ "id": "bad-project", INVALID }');

    try {
      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result.blocked).toBe(true);
      expect(result.imported).toEqual({ entityTypes: 0, entities: 0 });
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'project.json',
          documentKind: 'project',
          severity: 'error',
        }),
      );
    } finally {
      database.close();
    }
  });

  it('does not throw when project.json contains invalid JSON', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);
    await writeRaw(join(projectRoot, 'project.json'), '{ not valid json at all');

    try {
      await expect(importBaseJsonProject({ database, projectRoot })).resolves.toBeDefined();
    } finally {
      database.close();
    }
  });

  it('skips a malformed entity file and imports the remaining valid entities', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);
    await writeRaw(
      join(projectRoot, 'entities', 'Character', 'character-broken.json'),
      '{ "id": "character-broken", INVALID JSON',
    );

    try {
      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result.blocked).toBe(false);
      expect(result.imported.entities).toBe(1);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: expect.stringMatching(/entities[\\/]Character[\\/]character-broken\.json/u),
          documentKind: 'base_entity',
          severity: 'error',
        }),
      );

      const rows = database.prepare('SELECT id FROM base_entities ORDER BY id').all();
      expect(rows.map((r) => r.id)).toEqual(['character-ada']);
    } finally {
      database.close();
    }
  });

  it('does not throw when an entity file contains invalid JSON', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);
    await writeRaw(
      join(projectRoot, 'entities', 'Character', 'character-corrupt.json'),
      '}}broken{{',
    );

    try {
      await expect(importBaseJsonProject({ database, projectRoot })).resolves.toBeDefined();
    } finally {
      database.close();
    }
  });

  it('skips a malformed entity-type file and reports a structured error', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);
    await writeRaw(
      join(projectRoot, 'entity-types', 'broken-type.json'),
      '{ "id": "type-broken" MISSING_COMMA }',
    );

    try {
      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result.blocked).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: expect.stringMatching(/entity-types[\\/]broken-type\.json/u),
          severity: 'error',
        }),
      );
    } finally {
      database.close();
    }
  });

  it('preserves campaign rows when an entity file is malformed and import is partial', async () => {
    const projectRoot = createTemporaryProjectRoot();
    const database = createDatabase();
    await writeValidProjectBase(projectRoot);

    try {
      await importBaseJsonProject({ database, projectRoot });
      database
        .prepare('INSERT INTO campaign_notes (id, entity_id, note_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
        .run('note-1', 'character-ada', 'Session note.', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');

      await writeRaw(
        join(projectRoot, 'entities', 'Character', 'character-broken.json'),
        '{ bad json }',
      );

      const result = await importBaseJsonProject({ database, projectRoot });

      expect(result.blocked).toBe(false);
      const notes = database.prepare('SELECT id FROM campaign_notes').all();
      expect(notes.map((r) => r.id)).toEqual(['note-1']);
    } finally {
      database.close();
    }
  });
});
