// @vitest-environment node
// M9-S02: Formel-Engine für System-Felder
// See: https://github.com/Djimon/WorldBrain/issues/165

import { readFileSync } from 'node:fs';
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
    it('formula-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/formula-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });

  describe('function name whitelist (#221 — parser grammar must not exceed evaluator ops)', () => {
    it('unknown function name "sqrt(4)" is rejected by the parser itself (parse-error path)', async () => {
      const { parseFormula } = await getFormulaEngine();
      // Must throw at parse time — not silently produce an AST node that
      // evaluates to undefined later (the pre-#221 behavior).
      expect(() => parseFormula('sqrt(4)')).toThrow();
    });

    it('typo\'d function name "maxx(1,2)" is rejected by the parser itself', async () => {
      const { parseFormula } = await getFormulaEngine();
      expect(() => parseFormula('maxx(1, 2)')).toThrow();
    });

    it('evaluateFormula surfaces the parse rejection as null, not a throw', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(() => evaluateFormula('sqrt(4)', {})).not.toThrow();
      expect(evaluateFormula('sqrt(4)', {})).toBeNull();
    });

    it('existing supported functions remain green: floor/ceil/max/min', async () => {
      const { evaluateFormula, parseFormula } = await getFormulaEngine();
      expect(() => parseFormula('floor(3.7)')).not.toThrow();
      expect(evaluateFormula('floor(3.7)', {})).toBe(3);
      expect(evaluateFormula('ceil(3.2)', {})).toBe(4);
      expect(evaluateFormula('max(1, 2)', {})).toBe(2);
      expect(evaluateFormula('min(1, 2)', {})).toBe(1);
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
