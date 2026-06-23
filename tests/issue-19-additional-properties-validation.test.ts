// @vitest-environment node
// Tests for issue #19: additionalProperties: false in schemas must be enforced by the validator.
// See: https://github.com/Djimon/WorldBrain/issues/19

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

function doc(relativePath: string, data: unknown): BaseJsonDocument {
  return { path: relativePath, data };
}

function validProjectData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'project-test',
    title: 'Test Project',
    schema_version: '1.0.0',
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
}

function validEntityTypeData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entity-type-character',
    name: 'Character',
    title: 'Character',
    schema_version: '1.0.0',
    properties: {},
    created_at: '2026-06-23T00:00:00.000Z',
    updated_at: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
}

function validEntityData(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

function minimalInput(overrides: Partial<BaseJsonValidationInput> = {}): BaseJsonValidationInput {
  return {
    project: doc('project.json', validProjectData()),
    entityTypes: [doc('entity-types/character.json', validEntityTypeData())],
    entities: [doc('entities/Character/character-ada.json', validEntityData())],
    ...overrides,
  };
}

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
