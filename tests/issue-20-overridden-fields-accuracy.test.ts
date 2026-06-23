// @vitest-environment node
// Tests for issue #20: overriddenFields must only list fields that were actually applied.
// See: https://github.com/Djimon/WorldBrain/issues/20

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';

type ReadEffectiveEntityInput = {
  database: DatabaseSync;
  entityId: string;
};

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');
const openDatabases: DatabaseSync[] = [];

async function readEffectiveEntity(input: ReadEffectiveEntityInput) {
  const module = await import('../src/data/effective-entity');
  return module.readEffectiveEntity(input);
}

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(runtimeSchemaSql);
  openDatabases.push(database);
  return database;
}

afterEach(() => {
  while (openDatabases.length > 0) {
    openDatabases.pop()?.close();
  }
});

function insertBaseEntity(database: DatabaseSync, overrides: Record<string, unknown> = {}) {
  const entity = {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: JSON.stringify(['The Red Notary']),
    properties: JSON.stringify({ role: 'archivist', status: 'unknown' }),
    body: JSON.stringify({ format: 'portable_blocks_v1', blocks: [] }),
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
  database
    .prepare(
      [
        'INSERT INTO base_entities',
        '(id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)',
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      entity.id, entity.type, entity.title, entity.summary,
      entity.aliases, entity.properties, entity.body,
      entity.visibility, entity.created_at, entity.updated_at,
    );
}

function insertOverride(database: DatabaseSync, patch: Record<string, unknown>) {
  database
    .prepare(
      [
        'INSERT INTO campaign_entity_overrides',
        '(entity_id, patch_json, created_at, updated_at)',
        'VALUES (?, ?, ?, ?)',
      ].join(' '),
    )
    .run(
      'character-ada',
      JSON.stringify(patch),
      '2026-06-23T00:00:00.000Z',
      '2026-06-23T00:00:00.000Z',
    );
}

describe('issue #20: overriddenFields accuracy', () => {
  it('does not include "body" in overriddenFields when patch contains body but body is not an applied field', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { body: { format: 'portable_blocks_v1', blocks: [{ type: 'paragraph' }] } });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).not.toContain('body');
  });

  it('only lists fields that actually changed the effective entity value', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, {
      title: 'Ada Thorn (Renamed)',
      body: { format: 'portable_blocks_v1', blocks: [] },
      unknownField: 'ignored',
    });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toContain('title');
    expect(result.overriddenFields).not.toContain('body');
    expect(result.overriddenFields).not.toContain('unknownField');
  });

  it('does not list a field as overridden when the patch value equals the base value', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    // Patch sets title to the same value as base — not a real override
    insertOverride(database, { title: 'Ada Thorn' });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).not.toContain('title');
  });

  it('includes "title" in overriddenFields when patch changes the title', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { title: 'Lady Thorn' });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toContain('title');
    expect(result.entity.title).toBe('Lady Thorn');
  });

  it('includes "summary" in overriddenFields when patch changes the summary', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { summary: 'Now a fugitive.' });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toContain('summary');
    expect(result.overriddenFields).not.toContain('body');
  });

  it('includes "visibility" in overriddenFields when patch changes visibility', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { visibility: 'hidden' });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toContain('visibility');
  });

  it('includes "properties.role" in overriddenFields when a property key changes', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { properties: { role: 'fugitive' } });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toContain('properties.role');
    expect(result.overriddenFields).not.toContain('body');
  });

  it('returns an empty overriddenFields array when patch contains only unapplied fields', async () => {
    const database = createDatabase();
    insertBaseEntity(database);
    insertOverride(database, { body: { format: 'portable_blocks_v1', blocks: [] }, unknownField: 'x' });

    const result = await readEffectiveEntity({ database, entityId: 'character-ada' });

    expect(result.found).toBe(true);
    if (!result.found) return;

    expect(result.overriddenFields).toEqual([]);
  });
});
