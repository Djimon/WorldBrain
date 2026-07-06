// @vitest-environment node
// M9-S09: Conditionals in der Formel-Engine
// See: https://github.com/Djimon/WorldBrain/issues/222
//
// Note: this story is a pure formula-engine/parser extension (no new UI
// component or database consumer) — the AC's generic "database prop typed as
// DatabaseLike" boilerplate does not map to a concrete artifact here; not
// tested to avoid fabricating a non-existent requirement (AGENTS.md: no
// extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getFormulaEngine() { return import('../src/services/formula-engine'); }

describe('M9-S09 conditionals in the formula engine', () => {
  describe('comparison operators', () => {
    it('== : "1 + 1 == 2" → 1 (true coerced to number)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('1 + 1 == 2', {})).toBe(1);
    });

    it('!= : "3 != 4" → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('3 != 4', {})).toBe(1);
    });

    it('> : "10 - 5 > 2" → 1 (arithmetic binds tighter than comparison)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('10 - 5 > 2', {})).toBe(1);
    });

    it('>= : "5 >= 5" → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('5 >= 5', {})).toBe(1);
    });

    it('< : "3 < 2" → 0', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('3 < 2', {})).toBe(0);
    });

    it('<= : "2 <= 2" → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('2 <= 2', {})).toBe(1);
    });

    it('field reference in comparison: "dex > 10" with dex=14 → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('dex > 10', { dex: 14 })).toBe(1);
    });
  });

  describe('boolean combinators: and / or / not', () => {
    it('and(1, 1) → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('and(1, 1)', {})).toBe(1);
    });

    it('and(1, 0) → 0', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('and(1, 0)', {})).toBe(0);
    });

    it('or(0, 1) → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('or(0, 1)', {})).toBe(1);
    });

    it('or(0, 0) → 0', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('or(0, 0)', {})).toBe(0);
    });

    it('not(0) → 1', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('not(0)', {})).toBe(1);
    });

    it('not(1) → 0', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('not(1)', {})).toBe(0);
    });

    it('combined: and(dex > 10, str > 10) with dex=14, str=8 → 0', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('and(dex > 10, str > 10)', { dex: 14, str: 8 })).toBe(0);
    });
  });

  describe('if(cond, then, else) conditional', () => {
    it('if(1, 10, 20) → 10 (true branch)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('if(1, 10, 20)', {})).toBe(10);
    });

    it('if(0, 10, 20) → 20 (false branch)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('if(0, 10, 20)', {})).toBe(20);
    });

    it('AC example: if(is_unarmored, 10 + dex_mod, armor_ac) — unarmored branch', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      const result = evaluateFormula('if(is_unarmored, 10 + dex_mod, armor_ac)', {
        is_unarmored: 1, dex_mod: 2, armor_ac: 15,
      });
      expect(result).toBe(12);
    });

    it('AC example: if(is_unarmored, 10 + dex_mod, armor_ac) — armored branch', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      const result = evaluateFormula('if(is_unarmored, 10 + dex_mod, armor_ac)', {
        is_unarmored: 0, dex_mod: 2, armor_ac: 15,
      });
      expect(result).toBe(15);
    });

    it('nested if: if(a > 1, if(b > 1, 1, 2), 3)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('if(a > 1, if(b > 1, 1, 2), 3)', { a: 2, b: 2 })).toBe(1);
      expect(evaluateFormula('if(a > 1, if(b > 1, 1, 2), 3)', { a: 2, b: 0 })).toBe(2);
      expect(evaluateFormula('if(a > 1, if(b > 1, 1, 2), 3)', { a: 0, b: 2 })).toBe(3);
    });

    it('conditional bonus: 10 + if(is_raging, 2, 0)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('10 + if(is_raging, 2, 0)', { is_raging: 1 })).toBe(12);
      expect(evaluateFormula('10 + if(is_raging, 2, 0)', { is_raging: 0 })).toBe(10);
    });
  });

  describe('precedence: comparison binds looser than arithmetic', () => {
    it('"2 + 2 == 4" → 1 (arithmetic evaluated before comparison)', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(evaluateFormula('2 + 2 == 4', {})).toBe(1);
    });

    it('"10 - 5 > 2" → 1, not misparsed as "10 - (5 > 2)"', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      // Misparsed as 10 - (5>2)=10-1=9 would still be truthy but numerically
      // wrong — correct precedence yields the coerced boolean 1, not 9.
      expect(evaluateFormula('10 - 5 > 2', {})).toBe(1);
    });
  });

  describe('error handling: no crash on syntax/unknown-field errors', () => {
    it('malformed comparison does not throw — returns null', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(() => evaluateFormula('if(str >, 1, 2)', {})).not.toThrow();
      expect(evaluateFormula('if(str >, 1, 2)', {})).toBeNull();
    });

    it('unknown field in condition does not throw', async () => {
      const { evaluateFormula } = await getFormulaEngine();
      expect(() => evaluateFormula('if(unknown_field > 10, 1, 2)', {})).not.toThrow();
    });
  });

  describe('no eval()', () => {
    it('formula-engine.ts does not use eval() (conditionals included)', () => {
      const src = readFileSync('src/services/formula-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
