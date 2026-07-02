// @vitest-environment node
// M9-S02: Formel-Engine für System-Felder
// See: https://github.com/Djimon/WorldBrain/issues/165

import { describe, expect, it } from 'vitest';

async function getFormulaEngine() { return import('../src/services/formula-engine'); }

describe('M9-S02 formula engine', () => {
  describe('basic arithmetic', () => {
    it('evaluates addition: "2 + 3" → 5', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('2 + 3', {})).toBe(5);
    });

    it('evaluates subtraction: "10 - 4" → 6', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('10 - 4', {})).toBe(6);
    });

    it('evaluates multiplication: "3 * 4" → 12', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('3 * 4', {})).toBe(12);
    });

    it('evaluates division: "10 / 4" → 2.5', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('10 / 4', {})).toBe(2.5);
    });
  });

  describe('math functions', () => {
    it('floor((15 - 10) / 2) → 2', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('floor((15 - 10) / 2)', {})).toBe(2);
    });

    it('ceil(3.2) → 4', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('ceil(3.2)', {})).toBe(4);
    });

    it('max(3, 7) → 7', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('max(3, 7)', {})).toBe(7);
    });

    it('min(3, 7) → 3', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('min(3, 7)', {})).toBe(3);
    });
  });

  describe('field references', () => {
    it('references another field: "10 + floor((dex - 10) / 2)"', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      // dex = 14 → modifier = 2 → AC base = 12
      expect(evaluateFormula('10 + floor((dex - 10) / 2)', { dex: 14 })).toBe(12);
    });

    it('ability score modifier formula: floor((str - 10) / 2) for str=8 → -1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('floor((str - 10) / 2)', { str: 8 })).toBe(-1);
    });

    it('multiple field references: "str + dex" with str=3, dex=5 → 8', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('str + dex', { str: 3, dex: 5 })).toBe(8);
    });
  });

  describe('error handling', () => {
    it('returns null for division by zero', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('10 / 0', {})).toBeNull();
    });

    it('returns null for unknown field reference', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('strength', {})).toBeNull();
    });

    it('does not throw on malformed formula — returns null', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(() => evaluateFormula('(((', {})).not.toThrow();
      expect(evaluateFormula('(((', {})).toBeNull();
    });
  });

  describe('no eval()', () => {
    it('formula-engine.ts does not use eval()', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/formula-engine.ts', 'utf-8'));
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });

  describe('computed field schema', () => {
    it('evaluateFormulaField accepts entity object with computed field definition', async () => {
      const { evaluateFormulaField } = await getFormulaEngine();
      const entity = { str: 16, dex: 12 };
      const fieldDef = { computed: true, formula: 'floor((str - 10) / 2)' };
      const result = evaluateFormulaField(fieldDef, entity);
      expect(result).toBe(3);
    });

    it('evaluateFormulaField returns null when computed is false, even with a formula (#218)', async () => {
      const { evaluateFormulaField } = await getFormulaEngine();
      const entity = { str: 16 };
      const fieldDef = { computed: false, formula: 'str * 2' };
      const result = evaluateFormulaField(fieldDef, entity);
      expect(result).toBeNull();
    });

    it('evaluateFormulaField returns null when formula is absent', async () => {
      const { evaluateFormulaField } = await getFormulaEngine();
      const result = evaluateFormulaField({ computed: true }, { str: 10 });
      expect(result).toBeNull();
    });
  });
});
