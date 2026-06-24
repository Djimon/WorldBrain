// @vitest-environment node
// M4-S03: Condition engine — JsonLogic + arithmetic, evaluate() with session context.
// See: https://github.com/Djimon/WorldBrain/issues/51

import { describe, expect, it } from 'vitest';

async function getEngine() {
  return import('../src/services/condition-engine');
}

const ctx = {
  vars: { hp: 10, shield: 3, isNight: true, phase: 'combat', score: 7 },
  globals: { partyLevel: 4 },
  flags: { bossDefeated: false },
};

describe('M4-S03 condition engine', () => {
  describe('evaluate() export', () => {
    it('exports evaluate function', async () => {
      const mod = await getEngine();
      expect(typeof mod.evaluate).toBe('function');
    });

    it('evaluate returns a boolean', async () => {
      const { evaluate } = await getEngine();
      const result = evaluate({ '==': [1, 1] }, ctx);
      expect(typeof result).toBe('boolean');
    });
  });

  describe('basic JsonLogic operations', () => {
    it('== comparison: true when equal', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '==': [{ var: 'vars.phase' }, 'combat'] }, ctx)).toBe(true);
    });

    it('== comparison: false when not equal', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '==': [{ var: 'vars.phase' }, 'exploration'] }, ctx)).toBe(false);
    });

    it('!= comparison', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '!=': [{ var: 'vars.phase' }, 'exploration'] }, ctx)).toBe(true);
    });

    it('> comparison', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '>': [{ var: 'vars.hp' }, 5] }, ctx)).toBe(true);
    });

    it('>= comparison', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '>=': [{ var: 'vars.hp' }, 10] }, ctx)).toBe(true);
    });

    it('< comparison', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '<': [{ var: 'vars.hp' }, 5] }, ctx)).toBe(false);
    });

    it('<= comparison', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '<=': [{ var: 'vars.hp' }, 10] }, ctx)).toBe(true);
    });
  });

  describe('boolean logic', () => {
    it('AND: true when both true', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ 'and': [{ var: 'vars.isNight' }, { '>': [{ var: 'vars.hp' }, 0] }] }, ctx)).toBe(true);
    });

    it('AND: false when one is false', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ 'and': [{ var: 'vars.isNight' }, { var: 'flags.bossDefeated' }] }, ctx)).toBe(false);
    });

    it('OR: true when at least one is true', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ 'or': [{ var: 'flags.bossDefeated' }, { var: 'vars.isNight' }] }, ctx)).toBe(true);
    });

    it('NOT: negates boolean', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '!': [{ var: 'flags.bossDefeated' }] }, ctx)).toBe(true);
    });
  });

  describe('arithmetic operators', () => {
    it('+ addition', async () => {
      const { evaluate } = await getEngine();
      // hp(10) + shield(3) > 12 → true
      expect(evaluate({ '>': [{ '+': [{ var: 'vars.hp' }, { var: 'vars.shield' }] }, 12] }, ctx)).toBe(true);
    });

    it('- subtraction', async () => {
      const { evaluate } = await getEngine();
      // hp(10) - shield(3) == 7 → true
      expect(evaluate({ '==': [{ '-': [{ var: 'vars.hp' }, { var: 'vars.shield' }] }, 7] }, ctx)).toBe(true);
    });

    it('* multiplication', async () => {
      const { evaluate } = await getEngine();
      // shield(3) * 2 == 6 → true
      expect(evaluate({ '==': [{ '*': [{ var: 'vars.shield' }, 2] }, 6] }, ctx)).toBe(true);
    });

    it('/ division', async () => {
      const { evaluate } = await getEngine();
      // hp(10) / 2 == 5 → true
      expect(evaluate({ '==': [{ '/': [{ var: 'vars.hp' }, 2] }, 5] }, ctx)).toBe(true);
    });

    it('compound: (a + b) > (d / c)', async () => {
      const { evaluate } = await getEngine();
      // (hp + shield) > (score / shield) → (13) > (7/3 ≈ 2.33) → true
      expect(evaluate({
        '>': [
          { '+': [{ var: 'vars.hp' }, { var: 'vars.shield' }] },
          { '/': [{ var: 'vars.score' }, { var: 'vars.shield' }] },
        ],
      }, ctx)).toBe(true);
    });
  });

  describe('variable resolution', () => {
    it('resolves session variables from vars namespace', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '==': [{ var: 'vars.hp' }, 10] }, ctx)).toBe(true);
    });

    it('resolves global variables from globals namespace', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '==': [{ var: 'globals.partyLevel' }, 4] }, ctx)).toBe(true);
    });

    it('resolves flags from flags namespace', async () => {
      const { evaluate } = await getEngine();
      expect(evaluate({ '==': [{ var: 'flags.bossDefeated' }, false] }, ctx)).toBe(true);
    });
  });

  describe('evaluation properties', () => {
    it('is synchronous — returns a value immediately', async () => {
      const { evaluate } = await getEngine();
      const result = evaluate({ '==': [1, 1] }, ctx);
      expect(result instanceof Promise).toBe(false);
    });

    it('has no side effects — calling twice gives same result', async () => {
      const { evaluate } = await getEngine();
      const cond = { '>': [{ var: 'vars.hp' }, 5] };
      expect(evaluate(cond, ctx)).toBe(evaluate(cond, ctx));
    });
  });
});
