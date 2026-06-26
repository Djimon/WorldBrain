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

function validProjectData(extra: Record<string, unknown> = {}) {
  return {
    id: 'project-emberfall',
    title: 'Emberfall',
    schema_version: '1.0.0',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...extra,
  };
}

function validEntityTypeData(extra: Record<string, unknown> = {}) {
  return {
    id: 'entity-type-character',
    name: 'Character',
    title: 'Character',
    schema_version: '1.0.0',
    properties: {},
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...extra,
  };
}

function validEntityData(extra: Record<string, unknown> = {}) {
  return {
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
    ...extra,
  };
}

function doc(path: string, data: unknown): BaseJsonDocument {
  return { path, data };
}

function minimalInput(overrides: Partial<BaseJsonValidationInput> = {}): BaseJsonValidationInput {
  return {
    project: doc('project.json', validProjectData()),
    entityTypes: [doc('entity-types/character.json', validEntityTypeData())],
    entities: [doc('entities/Character/character-ada.json', validEntityData())],
    ...overrides,
  };
}

// Keep old name for backward compat with existing tests
function validLoadInput(): BaseJsonValidationInput {
  return minimalInput();
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

// Bug #19
describe('issue #19: additionalProperties: false enforcement', () => {
  describe('project.json', () => {
    it('blocks the import when project.json contains an unknown field', async () => {
      const result = await validateBaseJsonLoad(
        minimalInput({
          project: doc('project.json', validProjectData({ unknownField: 'oops' })),
        }),
      );

      expect(result.blocked).toBe(true);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'project.json',
          documentKind: 'project',
          severity: 'blocking',
        }),
      );
    });

    it('blocks the import when project.json has a typo field (visiblity instead of visibility)', async () => {
      const result = await validateBaseJsonLoad(
        minimalInput({
          project: doc('project.json', validProjectData({ visiblity: 'public' })),
        }),
      );

      expect(result.blocked).toBe(true);
    });

    it('accepts a valid project.json with no extra fields', async () => {
      const result = await validateBaseJsonLoad(minimalInput());

      expect(result.blocked).toBe(false);
    });
  });

  describe('entity-type documents', () => {
    it('rejects an entity-type file with an unknown field and reports a structured error', async () => {
      const result = await validateBaseJsonLoad(
        minimalInput({
          entityTypes: [doc('entity-types/character.json', validEntityTypeData({ runtimeOnlyField: true }))],
        }),
      );

      expect(result.blocked).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entity-types/character.json',
          documentKind: 'entity_type',
          severity: 'error',
        }),
      );
      expect(result.acceptedEntityTypes).toHaveLength(0);
    });

    it('accepts a valid entity-type file with no extra fields', async () => {
      const result = await validateBaseJsonLoad(minimalInput());

      expect(result.acceptedEntityTypes).toHaveLength(1);
    });
  });

  describe('entity documents', () => {
    it('rejects an entity file with an unknown top-level field and reports a structured error', async () => {
      const result = await validateBaseJsonLoad(
        minimalInput({
          entities: [
            doc(
              'entities/Character/character-ada.json',
              validEntityData({ runtimeOverride: { patched: true } }),
            ),
          ],
        }),
      );

      expect(result.blocked).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities/Character/character-ada.json',
          documentKind: 'base_entity',
          severity: 'error',
        }),
      );
      expect(result.acceptedEntities).toHaveLength(0);
    });

    it('catches a typo field in an entity (e.g. "visiblity" instead of "visibility")', async () => {
      const result = await validateBaseJsonLoad(
        minimalInput({
          entities: [
            doc(
              'entities/Character/character-typo.json',
              validEntityData({ visiblity: 'public' }),
            ),
          ],
        }),
      );

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'entities/Character/character-typo.json',
          documentKind: 'base_entity',
          severity: 'error',
        }),
      );
    });

    it('accepts a valid entity file with no extra fields', async () => {
      const result = await validateBaseJsonLoad(minimalInput());

      expect(result.acceptedEntities).toHaveLength(1);
    });
  });
});

