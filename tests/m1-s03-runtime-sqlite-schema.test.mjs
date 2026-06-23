import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const ignoredDirectories = new Set(['.git', 'dist', 'node_modules', 'src-tauri', 'worldbuilding_architecture_study']);
const requiredTables = Object.freeze([
  'base_entities',
  'base_entity_types',
  'campaign_entity_overrides',
  'campaign_notes',
]);

function listFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
      return [];
    }

    const absolutePath = join(directory, entry.name);

    if (entry.isDirectory()) {
      return listFiles(absolutePath);
    }

    return entry.isFile() ? [absolutePath] : [];
  });
}

function readRuntimeSchemaSql() {
  const candidates = listFiles(repoRoot)
    .filter((filePath) => extname(filePath) === '.sql')
    .map((filePath) => ({
      filePath,
      source: readFileSync(filePath, 'utf8'),
    }))
    .filter(({ source }) => (
      /\bCREATE\s+TABLE\b/iu.test(source) &&
      requiredTables.every((tableName) => new RegExp(`\\b${tableName}\\b`, 'u').test(source))
    ));

  assert.equal(
    candidates.length,
    1,
    `Expected exactly one repository-owned runtime SQLite schema SQL file defining ${requiredTables.join(', ')}`,
  );

  return {
    relativePath: relative(repoRoot, candidates[0].filePath).replaceAll('\\', '/'),
    source: candidates[0].source,
  };
}

function createRuntimeDatabase() {
  const database = new DatabaseSync(':memory:');
  const schema = readRuntimeSchemaSql();

  database.exec(schema.source);

  return { database, schema };
}

function listTables(database) {
  return database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((row) => row.name);
}

function listColumns(database, tableName) {
  return database
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .map((row) => ({
      name: row.name,
      type: String(row.type).toUpperCase(),
      notNull: row.notnull === 1,
      primaryKey: row.pk > 0,
    }));
}

function assertColumn(columns, columnName, typePattern, options = {}) {
  const column = columns.find(({ name }) => name === columnName);

  assert.ok(column, `Expected column ${columnName}`);
  assert.match(column.type, typePattern, `Expected column ${columnName} type to match ${typePattern}`);

  if (options.primaryKey === true) {
    assert.equal(column.primaryKey, true, `Expected column ${columnName} to be part of the primary key`);
  }

  if (options.notNull === true) {
    assert.equal(column.notNull, true, `Expected column ${columnName} to be NOT NULL`);
  }
}

test('M1-S03 provides one repository-owned SQL runtime schema migration', () => {
  const { relativePath, source } = readRuntimeSchemaSql();

  assert.match(relativePath, /(?:^|\/)(?:migrations|schema|schemas|data|db|database|runtime)(?:\/|$)/iu);
  assert.match(source, /\bCREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\b/iu, 'Expected idempotent CREATE TABLE statements');
});

test('M1-S03 creates required base and campaign tables in one empty SQLite database', () => {
  const { database } = createRuntimeDatabase();

  try {
    assert.deepEqual(listTables(database), [...requiredTables].sort());
  } finally {
    database.close();
  }
});

test('M1-S03 uses base_ prefix for rebuildable imported data and campaign_ prefix for durable runtime data', () => {
  const { database } = createRuntimeDatabase();

  try {
    const tables = listTables(database);
    const invalidTables = tables.filter((tableName) => !/^(?:base|campaign)_/u.test(tableName));

    assert.deepEqual(invalidTables, []);
    assert.ok(tables.some((tableName) => tableName.startsWith('base_')), 'Expected at least one base_ table');
    assert.ok(tables.some((tableName) => tableName.startsWith('campaign_')), 'Expected at least one campaign_ table');
  } finally {
    database.close();
  }
});

test('M1-S03 stores structured schema and entity payload fields as JSON text', () => {
  const { database } = createRuntimeDatabase();

  try {
    assertColumn(listColumns(database, 'base_entity_types'), 'schema_json', /TEXT/u, { notNull: true });
    assertColumn(listColumns(database, 'base_entities'), 'properties_json', /TEXT/u, { notNull: true });
    assertColumn(listColumns(database, 'base_entities'), 'body_json', /TEXT/u, { notNull: true });
    assertColumn(listColumns(database, 'campaign_entity_overrides'), 'patch_json', /TEXT/u, { notNull: true });
  } finally {
    database.close();
  }
});

test('M1-S03 schema creation is idempotent and preserves campaign rows when rerun', () => {
  const { database, schema } = createRuntimeDatabase();

  try {
    database
      .prepare(
        [
          'INSERT INTO campaign_notes',
          '(id, entity_id, note_text, created_at, updated_at)',
          'VALUES (?, ?, ?, ?, ?)',
        ].join(' '),
      )
      .run('note-1', 'character-ada', 'Session note', '2026-06-23T00:00:00.000Z', '2026-06-23T00:00:00.000Z');

    database.exec(schema.source);

    const noteCount = database.prepare('SELECT COUNT(*) AS count FROM campaign_notes').get().count;

    assert.equal(noteCount, 1);
  } finally {
    database.close();
  }
});
