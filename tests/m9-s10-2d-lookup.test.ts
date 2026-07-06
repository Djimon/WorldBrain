// @vitest-environment node
// M9-S10: 2D-Lookup (Tabellen mit zwei Schlüsseln)
// See: https://github.com/Djimon/WorldBrain/issues/223
//
// Note: pure formula-engine extension (no new UI component or database
// consumer) — the AC's generic "database prop typed as DatabaseLike"
// boilerplate does not map to a concrete artifact here; not tested to avoid
// fabricating a non-existent requirement (AGENTS.md: no extrapolation).

import { describe, expect, it } from 'vitest';

async function getFormulaEngine() { return import('../src/services/formula-engine'); }

// Spell slots (level-1 spells) by class × character level — exact match on
// class, threshold match on level (largest key ≤ level).
const SPELL_SLOTS_LVL1 = {
  wizard: { '1': 2, '2': 3, '3': 4, '5': 4 },
  fighter: { '1': 0 },
};

describe('M9-S10 2D lookup (two key fields)', () => {
  describe('resolveLookup2D — mixed exact (class) + threshold (level)', () => {
    it('wizard level 1 → 2 slots', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(resolveLookup2D(SPELL_SLOTS_LVL1, ['wizard', 1], ['exact', 'threshold'])).toBe(2);
    });

    it('wizard level 5 → 4 slots (threshold picks key "5")', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(resolveLookup2D(SPELL_SLOTS_LVL1, ['wizard', 5], ['exact', 'threshold'])).toBe(4);
    });

    it('wizard level 4 → 4 slots (threshold picks largest key ≤ 4, which is "3")', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(resolveLookup2D(SPELL_SLOTS_LVL1, ['wizard', 4], ['exact', 'threshold'])).toBe(4);
    });

    it('unknown class ("bard") → null, not a crash', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(() => resolveLookup2D(SPELL_SLOTS_LVL1, ['bard', 5], ['exact', 'threshold'])).not.toThrow();
      expect(resolveLookup2D(SPELL_SLOTS_LVL1, ['bard', 5], ['exact', 'threshold'])).toBeNull();
    });

    it('level below smallest threshold key → null', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(resolveLookup2D(SPELL_SLOTS_LVL1, ['wizard', 0], ['exact', 'threshold'])).toBeNull();
    });

    it('missing table → null, not a crash', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      expect(() => resolveLookup2D({}, ['wizard', 5], ['exact', 'threshold'])).not.toThrow();
      expect(resolveLookup2D({}, ['wizard', 5], ['exact', 'threshold'])).toBeNull();
    });
  });

  describe('evaluateLookupField2D — schema field integration', () => {
    it('resolves spell_slots_1_max for a wizard at level 5', async () => {
      const { evaluateLookupField2D } = await getFormulaEngine();
      const fieldDef = {
        computed: true,
        lookup: { table: 'spell_slots_lvl1', key_fields: ['class', 'level'] as [string, string], modes: ['exact', 'threshold'] as ['exact' | 'threshold', 'exact' | 'threshold'] },
      };
      const result = evaluateLookupField2D(fieldDef, { class: 'wizard', level: 5 }, { spell_slots_lvl1: SPELL_SLOTS_LVL1 });
      expect(result).toBe(4);
    });

    it('unknown class field value → null', async () => {
      const { evaluateLookupField2D } = await getFormulaEngine();
      const fieldDef = {
        computed: true,
        lookup: { table: 'spell_slots_lvl1', key_fields: ['class', 'level'] as [string, string], modes: ['exact', 'threshold'] as ['exact' | 'threshold', 'exact' | 'threshold'] },
      };
      const result = evaluateLookupField2D(fieldDef, { class: 'bard', level: 5 }, { spell_slots_lvl1: SPELL_SLOTS_LVL1 });
      expect(result).toBeNull();
    });
  });

  describe('1D regression: existing key_field/mode API unaffected', () => {
    it('resolveLookup (1D) still resolves threshold lookups correctly', async () => {
      const { resolveLookup } = await getFormulaEngine();
      const profByLevel = { '1': 2, '5': 3, '9': 4, '13': 5, '17': 6 };
      expect(resolveLookup(profByLevel, 5, 'threshold')).toBe(3);
    });

    it('evaluateLookupField (1D) still resolves a single-key lookup field', async () => {
      const { evaluateLookupField } = await getFormulaEngine();
      const fieldDef = { computed: true, lookup: { table: 'prof_by_level', key_field: 'level', mode: 'threshold' as const } };
      const result = evaluateLookupField(fieldDef, { level: 5 }, { prof_by_level: { '1': 2, '5': 3 } });
      expect(result).toBe(3);
    });
  });
});
