// @vitest-environment node
// M9-S11: Stabile Deklarations-IDs & Registry (Overlay-Voraussetzung)
// See: https://github.com/Djimon/WorldBrain/issues/244
//
// Note: pure in-memory registry over already-loaded declarations (field/
// formula/table) — no new UI component or DatabaseLike consumer in this
// story's AC. The generic "database prop typed as DatabaseLike" boilerplate
// does not map to a concrete artifact here; not tested to avoid fabricating
// a non-existent requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

describe('M9-S11 stable declaration IDs & registry', () => {
  describe('stable ID format', () => {
    it('makeStableId("formula", "ac_total") → "formula:ac_total"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('formula', 'ac_total')).toBe('formula:ac_total');
    });

    it('makeStableId("table", "prof_by_level") → "table:prof_by_level"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('table', 'prof_by_level')).toBe('table:prof_by_level');
    });

    it('makeStableId("field", "str_mod") → "field:str_mod"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('field', 'str_mod')).toBe('field:str_mod');
    });

    it('IDs are deterministic across repeated calls (stable over reloads)', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('formula', 'ac_total')).toBe(makeStableId('formula', 'ac_total'));
    });

    it('a name containing ":" is rejected — would make "kind:name" ambiguously parseable', async () => {
      const { makeStableId } = await getRegistry();
      expect(() => makeStableId('formula', 'a:b')).toThrow();
    });
  });

  describe('registerDeclaration / getDeclaration', () => {
    beforeEach(async () => {
      const { clearRegistry } = await getRegistry();
      clearRegistry('dnd5e_srd');
    });

    it('formula:ac_total is resolvable after registration', async () => {
      const { registerDeclaration, getDeclaration } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', { formula: 'if(is_unarmored, 10 + dex_mod, armor_ac)' });
      const decl = getDeclaration('dnd5e_srd', 'formula:ac_total');
      expect(decl).toEqual({ formula: 'if(is_unarmored, 10 + dex_mod, armor_ac)' });
    });

    it('table:prof_by_level is resolvable after registration', async () => {
      const { registerDeclaration, getDeclaration } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'table', 'prof_by_level', { '1': 2, '5': 3 });
      const decl = getDeclaration('dnd5e_srd', 'table:prof_by_level');
      expect(decl).toEqual({ '1': 2, '5': 3 });
    });

    it('unregistered ID resolves to undefined, not a crash', async () => {
      const { getDeclaration } = await getRegistry();
      expect(() => getDeclaration('dnd5e_srd', 'formula:nonexistent')).not.toThrow();
      expect(getDeclaration('dnd5e_srd', 'formula:nonexistent')).toBeUndefined();
    });

    it('registering the same kind+name twice at register-time warns (does not silently succeed without signal)', async () => {
      // Mirrors the existing registerPluginEntityType/registerPluginRelationType
      // convention in plugin-entity-service.ts: warn + "second definition wins" —
      // not a silent overwrite with zero signal.
      const { registerDeclaration } = await getRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', { formula: 'first' });
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', { formula: 'second' });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('register-time collision: second registration wins (consistent with getDeclaration read-after-write)', async () => {
      const { registerDeclaration, getDeclaration } = await getRegistry();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', { formula: 'first' });
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', { formula: 'second' });
      expect(getDeclaration('dnd5e_srd', 'formula:ac_total')).toEqual({ formula: 'second' });
      warnSpy.mockRestore();
    });
  });

  describe('listDeclarationIds', () => {
    beforeEach(async () => {
      const { clearRegistry } = await getRegistry();
      clearRegistry('dnd5e_srd');
    });

    it('lists all registered IDs for a plugin', async () => {
      const { registerDeclaration, listDeclarationIds } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'formula', 'ac_total', {});
      registerDeclaration('dnd5e_srd', 'table', 'prof_by_level', {});
      const ids = listDeclarationIds('dnd5e_srd');
      expect(ids).toContain('formula:ac_total');
      expect(ids).toContain('table:prof_by_level');
    });

    it('a plugin with no registrations lists an empty array', async () => {
      const { listDeclarationIds } = await getRegistry();
      expect(listDeclarationIds('unknown_plugin')).toEqual([]);
    });
  });

  describe('duplicate/colliding IDs within a plugin → validator error', () => {
    beforeEach(async () => {
      const { clearRegistry } = await getRegistry();
      clearRegistry('dnd5e_srd');
    });

    it('registering the same kind+name twice for one plugin produces a named error', async () => {
      const { validateNoDuplicateDeclarations } = await getRegistry();
      const declarations = [
        { kind: 'formula' as const, name: 'ac_total' },
        { kind: 'formula' as const, name: 'ac_total' },
      ];
      const errors = validateNoDuplicateDeclarations(declarations);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('formula:ac_total');
    });

    it('different kinds with the same name do not collide (field:x vs formula:x)', async () => {
      const { validateNoDuplicateDeclarations } = await getRegistry();
      const declarations = [
        { kind: 'field' as const, name: 'ac_total' },
        { kind: 'formula' as const, name: 'ac_total' },
      ];
      const errors = validateNoDuplicateDeclarations(declarations);
      expect(errors).toEqual([]);
    });

    it('#248: a name containing ":" is rejected via the same makeStableId guard as registerDeclaration (single source of ID format)', async () => {
      const { validateNoDuplicateDeclarations } = await getRegistry();
      const declarations = [{ kind: 'formula' as const, name: 'a:b' }];
      expect(() => validateNoDuplicateDeclarations(declarations)).toThrow();
    });
  });

  describe('regression: existing M9 declaration behavior unchanged (pure additive refactor)', () => {
    it('resolveComputedFields still resolves a plain formula field as before', async () => {
      const { resolveComputedFields } = await import('../src/services/formula-engine');
      const result = resolveComputedFields(
        { dex_mod: { computed: true, formula: 'floor((dex - 10) / 2)' } },
        { dex: 14 },
        {},
      );
      expect(result.dex_mod).toBe(2);
    });
  });

  describe('no eval()', () => {
    it('plugin-declaration-registry.ts does not use eval()', () => {
      const src = readFileSync('src/services/plugin-declaration-registry.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
