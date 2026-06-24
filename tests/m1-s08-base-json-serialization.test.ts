// @vitest-environment node

import { describe, expect, it } from 'vitest';

type BaseEntity = {
  id: string;
  type: string;
  title: string;
  summary?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  body?: {
    format: 'portable_blocks_v1';
    blocks: unknown[];
  };
  visibility?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

async function loadSerializationModule() {
  return import('../src/data/base-json-serialization');
}

function entityWithCanonicalInsertionOrder(): BaseEntity {
  return {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: ['The Red Notary'],
    properties: {
      role: 'archivist',
      rank: 2,
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

function equivalentEntityWithDifferentInsertionOrder(): BaseEntity {
  return {
    updated_at: '2026-06-23T00:00:00.000Z',
    created_at: '2026-06-23T00:00:00.000Z',
    visibility: 'public',
    body: {
      blocks: [],
      format: 'portable_blocks_v1',
    },
    properties: {
      rank: 2,
      role: 'archivist',
    },
    aliases: ['The Red Notary'],
    summary: 'Archivist with a disputed inheritance.',
    title: 'Ada Thorn',
    type: 'Character',
    id: 'character-ada',
  };
}

describe('M1-S08 deterministic base JSON serialization', () => {
  it('serializes equivalent base entities deterministically with stable formatting and key order', async () => {
    const { serializeBaseEntity } = await loadSerializationModule();

    const first = serializeBaseEntity(entityWithCanonicalInsertionOrder());
    const second = serializeBaseEntity(equivalentEntityWithDifferentInsertionOrder());

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(JSON.parse(first), null, 2)}\n`);
    expect(first).toMatch(
      /"id": "character-ada",\n  "type": "Character",\n  "title": "Ada Thorn",\n  "summary":/u,
    );
  });

  it('generates stable entity filenames from type and stable id, not mutable title alone', async () => {
    const { createBaseEntityFilename } = await loadSerializationModule();
    const original = entityWithCanonicalInsertionOrder();
    const renamed = {
      ...original,
      title: 'Ada Thorn, Queen of Cinders',
    };

    expect(createBaseEntityFilename(original)).toBe('entities/Character/character-ada.json');
    expect(createBaseEntityFilename(renamed)).toBe('entities/Character/character-ada.json');
  });

  it('does not emit runtime DB-only fields when serializing base entity JSON', async () => {
    const { serializeBaseEntity } = await loadSerializationModule();
    const serialized = serializeBaseEntity({
      ...entityWithCanonicalInsertionOrder(),
      database_rowid: 123,
      imported_at: '2026-06-23T01:00:00.000Z',
      search_rank: 0.87,
      effective_title: 'Campaign title override',
    });

    expect(serialized).not.toMatch(/database_rowid|imported_at|search_rank|effective_title/u);
    expect(JSON.parse(serialized)).toEqual(entityWithCanonicalInsertionOrder());
  });

  it('does not serialize campaign or session progression into base entity JSON', async () => {
    const { serializeBaseEntity } = await loadSerializationModule();
    const serialized = serializeBaseEntity({
      ...entityWithCanonicalInsertionOrder(),
      campaign_notes: ['Met in session 3'],
      campaign_overrides: {
        title: 'Secret campaign alias',
      },
      session_progression: {
        discovered: true,
      },
    });

    expect(serialized).not.toMatch(/campaign_notes|campaign_overrides|session_progression/u);
    expect(serialized).toMatch(/"title": "Ada Thorn"/u);
  });

  // Bug #123: keys not listed in entityFieldOrder must not be silently dropped
  it('preserves keys that are not in entityFieldOrder', async () => {
    const { serializeBaseEntity } = await loadSerializationModule();
    const entityWithExtraKey: BaseEntity = {
      ...entityWithCanonicalInsertionOrder(),
      custom_campaign_flag: 'red_herring',
    };

    const serialized = serializeBaseEntity(entityWithExtraKey);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed).toHaveProperty('custom_campaign_flag', 'red_herring');
  });

  it('preserves all canonical schema keys even when entity is constructed in reverse order', async () => {
    const { serializeBaseEntity } = await loadSerializationModule();
    const entity: BaseEntity = equivalentEntityWithDifferentInsertionOrder();

    const serialized = serializeBaseEntity(entity);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(parsed).toHaveProperty('id', 'character-ada');
    expect(parsed).toHaveProperty('type', 'Character');
    expect(parsed).toHaveProperty('title', 'Ada Thorn');
    expect(parsed).toHaveProperty('summary');
    expect(parsed).toHaveProperty('aliases');
    expect(parsed).toHaveProperty('properties');
    expect(parsed).toHaveProperty('body');
    expect(parsed).toHaveProperty('visibility');
    expect(parsed).toHaveProperty('created_at');
    expect(parsed).toHaveProperty('updated_at');
  });

  it('serializes project metadata deterministically with configured indentation and trailing newline', async () => {
    const { serializeProjectMetadata } = await loadSerializationModule();
    const first = serializeProjectMetadata({
      updated_at: '2026-06-23T00:00:00.000Z',
      created_at: '2026-06-23T00:00:00.000Z',
      schema_version: '1.0.0',
      title: 'Emberfall',
      id: 'project-emberfall',
    });
    const second = serializeProjectMetadata({
      id: 'project-emberfall',
      title: 'Emberfall',
      schema_version: '1.0.0',
      created_at: '2026-06-23T00:00:00.000Z',
      updated_at: '2026-06-23T00:00:00.000Z',
    });

    expect(first).toBe(second);
    expect(first).toBe(`${JSON.stringify(JSON.parse(first), null, 2)}\n`);
    expect(first).toMatch(/^\{\n  "id": "project-emberfall",/u);
  });
});
