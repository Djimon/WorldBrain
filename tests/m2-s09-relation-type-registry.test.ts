// @vitest-environment node
// M2-S09: Define relation type registry.
// See: https://github.com/Djimon/WorldBrain/issues/37

import { describe, expect, it } from 'vitest';

async function getRegistry() {
  return import('../src/data/relation-type-registry');
}

describe('M2-S09 relation type registry', () => {
  describe('RelationType enum', () => {
    it('exports a RelationType enum or const object', async () => {
      const mod = await getRegistry();
      expect((mod as Record<string, unknown>).RelationType).toBeDefined();
    });

    it('has all 9 core relation types', async () => {
      const { RelationType } = await getRegistry();
      const types = Object.values(RelationType as Record<string, string>);

      expect(types).toContain('located_in');
      expect(types).toContain('part_of');
      expect(types).toContain('ranks_above');
      expect(types).toContain('ally_of');
      expect(types).toContain('enemy_of');
      expect(types).toContain('blood_relative');
      expect(types).toContain('owns');
      expect(types).toContain('knows_secret');
      expect(types).toContain('connected_to');
    });
  });

  describe('relation type definitions', () => {
    it('each type definition has relation_type, inverse_type, symmetry, label, inverse_label', async () => {
      const { getRelationTypeDefinition, RelationType } = await getRegistry();
      const types = Object.values(RelationType as Record<string, string>);

      for (const type of types) {
        const def = getRelationTypeDefinition(type);
        expect(def, `definition for ${type}`).toBeDefined();
        expect(def).toHaveProperty('relation_type');
        expect(def).toHaveProperty('inverse_type');
        expect(def).toHaveProperty('symmetry');
        expect(def).toHaveProperty('label');
        expect(def).toHaveProperty('inverse_label');
      }
    });

    it('symmetry field is either "directed" or "symmetric"', async () => {
      const { getRelationTypeDefinition, RelationType } = await getRegistry();
      const types = Object.values(RelationType as Record<string, string>);

      for (const type of types) {
        const def = getRelationTypeDefinition(type);
        expect(['directed', 'symmetric'], `symmetry for ${type}`).toContain(def?.symmetry);
      }
    });
  });

  describe('directed relation types', () => {
    it('located_in inverse is contains', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('located_in');
      expect(def?.inverse_type).toBe('contains');
    });

    it('part_of inverse is has_part', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('part_of');
      expect(def?.inverse_type).toBe('has_part');
    });

    it('ranks_above inverse is ranks_below', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('ranks_above');
      expect(def?.inverse_type).toBe('ranks_below');
    });

    it('owns inverse is owned_by', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('owns');
      expect(def?.inverse_type).toBe('owned_by');
    });

    it('knows_secret inverse is secret_known_by', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('knows_secret');
      expect(def?.inverse_type).toBe('secret_known_by');
    });
  });

  describe('symmetric relation types', () => {
    it('ally_of has identical relation_type and inverse_type', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('ally_of');
      expect(def?.symmetry).toBe('symmetric');
      expect(def?.relation_type).toBe(def?.inverse_type);
    });

    it('enemy_of is symmetric', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('enemy_of');
      expect(def?.symmetry).toBe('symmetric');
      expect(def?.relation_type).toBe(def?.inverse_type);
    });

    it('blood_relative is symmetric', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('blood_relative');
      expect(def?.symmetry).toBe('symmetric');
      expect(def?.relation_type).toBe(def?.inverse_type);
    });

    it('connected_to is symmetric', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      const def = getRelationTypeDefinition('connected_to');
      expect(def?.symmetry).toBe('symmetric');
      expect(def?.relation_type).toBe(def?.inverse_type);
    });

    it('all symmetric types have identical relation_type and inverse_type', async () => {
      const { getRelationTypeDefinition, RelationType } = await getRegistry();
      const types = Object.values(RelationType as Record<string, string>);

      for (const type of types) {
        const def = getRelationTypeDefinition(type);
        if (def?.symmetry === 'symmetric') {
          expect(def.relation_type, `symmetric invariant for ${type}`).toBe(def.inverse_type);
        }
      }
    });
  });

  describe('registry lookup', () => {
    it('getRelationTypeDefinition returns undefined for unknown types', async () => {
      const { getRelationTypeDefinition } = await getRegistry();
      expect(getRelationTypeDefinition('nonexistent_type')).toBeUndefined();
    });

    it('getAllRelationTypes returns all 9 types', async () => {
      const { getAllRelationTypes } = await getRegistry();
      const all = getAllRelationTypes();
      expect(all.length).toBe(9);
    });
  });
});

// Bug #63
describe('issue-63 part_of label correction', () => {
  describe('part_of relation type definition', () => {
    it('part_of label is "part of" (not "member of")', async () => {
      const { getRelationTypeDefinition } = await import('../src/data/relation-type-registry');
      const def = getRelationTypeDefinition('part_of');
      expect(def?.label).toBe('part of');
    });

    it('part_of inverse_label is "has part" (not "has member")', async () => {
      const { getRelationTypeDefinition } = await import('../src/data/relation-type-registry');
      const def = getRelationTypeDefinition('part_of');
      expect(def?.inverse_label).toBe('has part');
    });

    it('part_of inverse_type is "has_part"', async () => {
      const { getRelationTypeDefinition } = await import('../src/data/relation-type-registry');
      const def = getRelationTypeDefinition('part_of');
      expect(def?.inverse_type).toBe('has_part');
    });

    it('part_of symmetry is "directed"', async () => {
      const { getRelationTypeDefinition } = await import('../src/data/relation-type-registry');
      const def = getRelationTypeDefinition('part_of');
      expect(def?.symmetry).toBe('directed');
    });
  });

  describe('source-level: no "member of" label for part_of', () => {
    it('relation-type-registry.ts does not use "member of" as part_of label', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/data/relation-type-registry.ts', 'utf-8');
      // "member of" should not appear as the label for part_of in the registry
      // (It may exist as a comment or in a different context, but not as part_of's label value)
      expect(src).not.toMatch(/part_of[\s\S]{0,200}member of/);
    });
  });
});

