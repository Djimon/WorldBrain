// @vitest-environment node
// M2 gap: entity_embed color mapping from EPIC-003 decision not implemented.
// ENTITY_TYPE_COLORS must exist as a typed constant covering all 10 entity types.
// See: https://github.com/Djimon/WorldBrain/issues/34

import { describe, expect, it } from 'vitest';

describe('issue-34 entity_embed color mapping', () => {
  describe('ENTITY_TYPE_COLORS constant', () => {
    it('is exported from block-registry or entity-type-colors module', async () => {
      // Accept either location as per the issue's "Files" options
      let colors: Record<string, string> | undefined;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }
      expect(colors).toBeDefined();
    });

    it('covers all 10 entity types from the EPIC-003 decision table', async () => {
      let colors: Record<string, string>;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }

      const required = [
        'Character',
        'Location',
        'Faction',
        'Item',
        'Event',
        'Quest',
        'Scene',
        'Rule',
        'Resource',
        'Culture',
      ];
      for (const type of required) {
        expect(colors).toHaveProperty(type);
      }
    });

    it('Character maps to purple', async () => {
      let colors: Record<string, string>;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }
      expect(colors['Character']).toMatch(/purple/i);
    });

    it('Location maps to teal', async () => {
      let colors: Record<string, string>;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }
      expect(colors['Location']).toMatch(/teal/i);
    });

    it('Faction maps to blue', async () => {
      let colors: Record<string, string>;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }
      expect(colors['Faction']).toMatch(/blue/i);
    });

    it('all color values are non-empty strings', async () => {
      let colors: Record<string, string>;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS as Record<string, string>;
      }
      for (const [type, color] of Object.entries(colors)) {
        expect(typeof color, `color for ${type}`).toBe('string');
        expect(color.length, `color for ${type}`).toBeGreaterThan(0);
      }
    });

    it('is a const object (not a function or class)', async () => {
      let colors: unknown;
      try {
        const mod = await import('../src/blocks/entity-type-colors');
        colors = mod.ENTITY_TYPE_COLORS;
      } catch {
        const mod = await import('../src/blocks/block-registry');
        colors = (mod as Record<string, unknown>).ENTITY_TYPE_COLORS;
      }
      expect(typeof colors).toBe('object');
      expect(colors).not.toBeNull();
      expect(typeof colors).not.toBe('function');
    });
  });
});
