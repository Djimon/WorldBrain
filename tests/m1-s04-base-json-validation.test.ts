// @vitest-environment node

import { describe, expect, it } from 'vitest';

type BaseJsonDocument = {
  path: string;
  data: unknown;
};

type BaseJsonValidationInput = {
  project: BaseJsonDocument;
  entityTypes: BaseJsonDocument[];
  entities: BaseJsonDocument[];
};

async function validateBaseJsonLoad(input: BaseJsonValidationInput) {
  const module = await import('../src/data/base-json-validation');

  return module.validateBaseJsonLoad(input);
}

function validProjectData() {
  return {
    id: 'project-emberfall',
    title: 'Emberfall',
    schema_version: '1.0.0',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };
}

function validCharacterTypeData() {
  return {
    id: 'entity-type-character',
    name: 'Character',
    title: 'Character',
    schema_version: '1.0.0',
    properties: {},
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };
}

function validCharacterEntityData() {
  return {
    id: 'character-ada',
    type: 'Character',
    title: 'Ada Thorn',
    summary: 'Archivist with a disputed inheritance.',
    aliases: [],
    properties: {},
    body: {
      format: 'portable_blocks_v1',
      blocks: [],
    },
    visibility: 'public',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
  };
}

function validLoadInput(): BaseJsonValidationInput {
  return {
    project: {
      path: 'project.json',
      data: validProjectData(),
    },
    entityTypes: [
      {
        path: 'entity-types/character.json',
        data: validCharacterTypeData(),
      },
    ],
    entities: [
      {
        path: 'entities/Character/character-ada.json',
        data: validCharacterEntityData(),
      },
    ],
  };
}

describe('M1-S04 base JSON validation policy', () => {
  it('accepts valid project metadata, entity type definitions, and dependent base entities', async () => {
    const result = await validateBaseJsonLoad(validLoadInput());

    expect(result.blocked).toBe(false);
    expect(result.errors).toEqual([]);
    expect(result.acceptedProject?.id).toBe('project-emberfall');
    expect(result.acceptedEntityTypes).toHaveLength(1);
    expect(result.acceptedEntities).toHaveLength(1);
  });

  it('treats invalid project.json as a blocking project-level failure', async () => {
    const input = validLoadInput();
    input.project = {
      path: 'project.json',
      data: {
        title: 'Missing stable project identity',
      },
    };

    const result = await validateBaseJsonLoad(input);

    expect(result.blocked).toBe(true);
    expect(result.acceptedProject).toBeUndefined();
    expect(result.acceptedEntityTypes).toEqual([]);
    expect(result.acceptedEntities).toEqual([]);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'project.json',
        documentKind: 'project',
        severity: 'blocking',
      }),
    );
  });

  it('skips an invalid independent base entity and reports a structured non-blocking error', async () => {
    const input = validLoadInput();
    input.entities.push({
      path: 'entities/Character/character-broken.json',
      data: {
        type: 'Character',
        summary: 'Missing id and title.',
      },
    });

    const result = await validateBaseJsonLoad(input);

    expect(result.blocked).toBe(false);
    expect(result.acceptedEntities.map((entity) => entity.id)).toEqual(['character-ada']);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'entities/Character/character-broken.json',
        documentKind: 'base_entity',
        severity: 'error',
      }),
    );
  });

  it('reports invalid entity type definitions and skips dependent entities of that type', async () => {
    const input = validLoadInput();
    input.entityTypes[0] = {
      path: 'entity-types/character.json',
      data: {
        id: 'entity-type-character',
        title: 'Character without required name',
      },
    };

    const result = await validateBaseJsonLoad(input);

    expect(result.blocked).toBe(false);
    expect(result.acceptedEntityTypes).toEqual([]);
    expect(result.acceptedEntities).toEqual([]);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'entity-types/character.json',
          documentKind: 'entity_type',
          severity: 'error',
        }),
        expect.objectContaining({
          path: 'entities/Character/character-ada.json',
          documentKind: 'base_entity',
          severity: 'error',
        }),
      ]),
    );
  });

  it('returns actionable structured validation errors and does not mutate input documents', async () => {
    const input = validLoadInput();
    input.entities[0] = {
      path: 'entities/Character/character-ada.json',
      data: {
        ...validCharacterEntityData(),
        body: {
          format: 'unsupported_blocks',
          blocks: [],
        },
      },
    };
    const originalInput = structuredClone(input);

    const result = await validateBaseJsonLoad(input);

    expect(input).toEqual(originalInput);
    expect(result.errors).toEqual([
      expect.objectContaining({
        path: 'entities/Character/character-ada.json',
        documentKind: 'base_entity',
        severity: 'error',
        message: expect.stringMatching(/portable_blocks_v1|body|format/iu),
      }),
    ]);
    expect(JSON.stringify(result)).not.toMatch(/campaign_/u);
  });
});
