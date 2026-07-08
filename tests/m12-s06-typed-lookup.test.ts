// @vitest-environment node
// M12-S06: Typisierte Tabellen-Zellen & parametrisierter Lookup
// See: https://github.com/Djimon/WorldBrain/issues/231
//
// Note: pure lookup extension (no new UI component or DatabaseLike consumer
// in this story's Unit-Tests bullet) — the generic "database prop typed as
// DatabaseLike" boilerplate does not map to a concrete artifact here; not
// tested to avoid fabricating a non-existent requirement (AGENTS.md: no
// extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getTypedLookup() { return import('../src/services/typed-lookup-resolver'); }
async function getFormulaEngine() { return import('../src/services/formula-engine'); }

const COC_DAMAGE_BONUS_TABLE = {
  '0': { type: 'dice' as const, value: '1d4' },
  '165': { type: 'dice' as const, value: '1d6' },
};

const DAGGERHEART_DAMAGE_THRESHOLDS = {
  '1': { type: 'scalar' as const, value: 1 },
  '8': { type: 'scalar' as const, value: 2 },
  '15': { type: 'scalar' as const, value: 3 },
};

describe('M12-S06 typed table cells & parameterized lookup', () => {
  describe('typed cells: dice-returning lookup (CoC Damage Bonus)', () => {
    it('STR+SIZ 130 → +1d4', async () => {
      const { resolveTypedCell } = await getTypedLookup();
      const cell = resolveTypedCell(COC_DAMAGE_BONUS_TABLE, 130, 'threshold');
      expect(cell).toEqual({ type: 'dice', value: '1d4' });
    });

    it('STR+SIZ 170 → +1d6', async () => {
      const { resolveTypedCell } = await getTypedLookup();
      const cell = resolveTypedCell(COC_DAMAGE_BONUS_TABLE, 170, 'threshold');
      expect(cell).toEqual({ type: 'dice', value: '1d6' });
    });
  });

  describe('parameterized key: lookup against an external value, not an own field (Daggerheart Damage Thresholds)', () => {
    it('incoming_damage between major(8) and severe(15) → 2 marks', async () => {
      const { resolveTypedCell } = await getTypedLookup();
      const incomingDamage = 10;
      const cell = resolveTypedCell(DAGGERHEART_DAMAGE_THRESHOLDS, incomingDamage, 'threshold');
      expect(cell).toEqual({ type: 'scalar', value: 2 });
    });

    it('threshold boundaries stay formulas (armor_minor + level) — resolved before the lookup call', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      // The threshold itself is a formula; the parameterized lookup just
      // consumes its resolved numeric value as the key.
      expect(evaluateFormula('armor_minor + level', { armor_minor: 5, level: 3 })).toBe(8);
    });
  });

  describe('error handling: missing table / no qualifying key → null, not a crash', () => {
    it('missing table returns null', async () => {
      const { resolveTypedCell } = await getTypedLookup();
      expect(() => resolveTypedCell({}, 130, 'threshold')).not.toThrow();
      expect(resolveTypedCell({}, 130, 'threshold')).toBeNull();
    });

    it('key below smallest threshold returns null', async () => {
      const { resolveTypedCell } = await getTypedLookup();
      expect(resolveTypedCell(DAGGERHEART_DAMAGE_THRESHOLDS, 0, 'threshold')).toBeNull();
    });
  });

  describe('1D/2D lookup backward compatibility (M9-S07/S10 unaffected)', () => {
    it('resolveLookup (1D) still works unchanged', async () => {
      const { resolveLookup } = await getFormulaEngine();
      expect(resolveLookup({ '1': 2, '5': 3 }, 5, 'threshold')).toBe(3);
    });

    it('resolveLookup2D (2D) still works unchanged', async () => {
      const { resolveLookup2D } = await getFormulaEngine();
      const table = { wizard: { '1': 2, '5': 4 } };
      expect(resolveLookup2D(table, ['wizard', 5], ['exact', 'threshold'])).toBe(4);
    });
  });

  describe('no eval()', () => {
    it('typed-lookup-resolver.ts does not use eval()', () => {
      const src = readFileSync('src/services/typed-lookup-resolver.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
