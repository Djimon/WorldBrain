// @vitest-environment node
// M9-S07: lookup-Feldtyp & Tabellen-Resolver
// See: https://github.com/Djimon/WorldBrain/issues/219
//
// Note: this story adds no new UI component/database consumer (pure formula-engine
// extension + a Tauri-fs table loader) — the AC's generic "database prop typed as
// DatabaseLike" boilerplate does not map to a concrete artifact here; not tested to
// avoid fabricating a non-existent requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
}));

async function getFormulaEngine() { return import('../src/services/formula-engine'); }
async function getTableLoader() { return import('../src/services/plugin-table-loader'); }

const PROF_BY_LEVEL = { '1': 2, '5': 3, '9': 4, '13': 5, '17': 6 };

describe('M9-S07 lookup field type & table resolver', () => {
  describe('resolveLookup — threshold mode', () => {
    it('level 4 → prof_bonus 2 (largest key ≤ 4)', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 4, 'threshold')).toBe(2);
    });

    it('level 5 → prof_bonus 3', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 5, 'threshold')).toBe(3);
    });

    it('level 17 → prof_bonus 6', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 17, 'threshold')).toBe(6);
    });
  });

  describe('resolveLookup — exact mode', () => {
    it('exact key hit returns the value', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 5, 'exact')).toBe(3);
    });

    it('no exact match returns null (not a crash)', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 4, 'exact')).toBeNull();
    });
  });

  describe('resolveLookup — error cases (field shows "—" not crash)', () => {
    it('empty table returns null instead of throwing', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(() => resolveLookup({}, 4, 'threshold')).not.toThrow();
      expect(resolveLookup({}, 4, 'threshold')).toBeNull();
    });

    it('threshold key below smallest table key returns null', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup(PROF_BY_LEVEL, 0, 'threshold')).toBeNull();
    });
  });

  describe('evaluateLookupField', () => {
    it('resolves computed lookup field against entity + tables', async () => {
      const { evaluateLookupField } = await getFormulaEngine();
      const fieldDef = { computed: true, lookup: { table: 'prof_by_level', key_field: 'level', mode: 'threshold' as const } };
      const result = evaluateLookupField(fieldDef, { level: 5 }, { prof_by_level: PROF_BY_LEVEL });
      expect(result).toBe(3);
    });

    it('missing table returns null, not a crash', async () => {
      const { evaluateLookupField } = await getFormulaEngine();
      const fieldDef = { computed: true, lookup: { table: 'nonexistent_table', key_field: 'level', mode: 'threshold' as const } };
      expect(() => evaluateLookupField(fieldDef, { level: 5 }, {})).not.toThrow();
      expect(evaluateLookupField(fieldDef, { level: 5 }, {})).toBeNull();
    });

    it('missing key_field on entity returns null', async () => {
      const { evaluateLookupField } = await getFormulaEngine();
      const fieldDef = { computed: true, lookup: { table: 'prof_by_level', key_field: 'level', mode: 'threshold' as const } };
      expect(evaluateLookupField(fieldDef, {}, { prof_by_level: PROF_BY_LEVEL })).toBeNull();
    });
  });

  describe('chaining lookup → formula (Decision 12/13)', () => {
    it('skill_mod = dex_mod + prof_bonus resolves through topo order', async () => {
      const { resolveComputedFields } = await getFormulaEngine();
      const fields = {
        dex_mod: { computed: true, formula: 'floor((dex - 10) / 2)' },
        prof_bonus: { computed: true, lookup: { table: 'prof_by_level', key_field: 'level', mode: 'threshold' as const } },
        skill_mod: { computed: true, formula: 'dex_mod + prof_bonus' },
      };
      const result = resolveComputedFields(fields, { dex: 14, level: 5 }, { prof_by_level: PROF_BY_LEVEL });
      // dex_mod = floor((14-10)/2) = 2, prof_bonus = 3 (level 5) → skill_mod = 5
      expect(result.skill_mod).toBe(5);
    });

    it('detects a cycle and returns null for the cyclic fields instead of an infinite loop', async () => {
      const { resolveComputedFields } = await getFormulaEngine();
      const fields = {
        a: { computed: true, formula: 'b + 1' },
        b: { computed: true, formula: 'a + 1' },
      };
      expect(() => resolveComputedFields(fields, {}, {})).not.toThrow();
      const result = resolveComputedFields(fields, {}, {});
      expect(result.a).toBeNull();
      expect(result.b).toBeNull();
    });
  });

  describe('loadPluginTable (tables/*.json as plugin data)', () => {
    it('is async', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(PROF_BY_LEVEL));
      const { loadPluginTable } = await getTableLoader();
      expect(loadPluginTable('dnd5e-srd', 'prof_by_level')).toBeInstanceOf(Promise);
    });

    it('loads and returns the table indexed by key', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(PROF_BY_LEVEL));
      const { loadPluginTable } = await getTableLoader();
      const table = await loadPluginTable('dnd5e-srd', 'prof_by_level');
      expect(table['5']).toBe(3);
    });

    it('missing table file resolves to empty object, not a throw', async () => {
      const { readTextFile } = await import('@tauri-apps/plugin-fs');
      (readTextFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('ENOENT'));
      const { loadPluginTable } = await getTableLoader();
      await expect(loadPluginTable('dnd5e-srd', 'missing_table')).resolves.toEqual({});
    });
  });

  describe('no eval()', () => {
    it('formula-engine.ts does not use eval() (lookup extension included)', () => {
      const src = readFileSync('src/services/formula-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
