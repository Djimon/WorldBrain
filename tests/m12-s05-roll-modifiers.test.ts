// @vitest-environment node
// M12-S05: Wurf-Modifikatoren — Advantage/Disadvantage & Bonus/Penalty
// See: https://github.com/Djimon/WorldBrain/issues/230
//
// Note: pure descriptor-resolver (no new UI component or DatabaseLike
// consumer in this story's Unit-Tests bullet) — the generic "database prop
// typed as DatabaseLike" boilerplate does not map to a concrete artifact
// here; not tested to avoid fabricating a non-existent requirement
// (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getRollModifierEngine() { return import('../src/services/roll-modifier-engine'); }

const ADVANTAGE = { kind: 'keep' as const, of: 2, keep: 'best' as const, stacking: 'cancel-pairwise' as const };
const DISADVANTAGE = { kind: 'keep' as const, of: 2, keep: 'worst' as const, stacking: 'cancel-pairwise' as const };
const BONUS_DIE = { kind: 'extra-die' as const, of: 1, pool: 'tens' as const, keep: 'best' as const, stacking: 'cancel-pairwise' as const };
const PENALTY_DIE = { kind: 'extra-die' as const, of: 1, pool: 'tens' as const, keep: 'worst' as const, stacking: 'cancel-pairwise' as const };

describe('M12-S05 roll modifiers (advantage/disadvantage, bonus/penalty dice)', () => {
  describe('D&D Advantage = keep of:2 keep:best', () => {
    it('a single advantage resolves to keep-best', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE]);
      expect(nets).toEqual([{ kind: 'keep', keep: 'best', count: 1 }]);
    });
  });

  describe('CoC Bonus die = extra-die pool:tens keep:best', () => {
    it('a single bonus die resolves to extra-die keep-best', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([BONUS_DIE]);
      expect(nets).toEqual([{ kind: 'extra-die', keep: 'best', count: 1 }]);
    });
  });

  describe('pairwise cancel (AC unit test)', () => {
    it('advantage + disadvantage → normal (empty result)', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE, DISADVANTAGE]);
      expect(nets).toEqual([]);
    });

    it('two penalty dice + one bonus die → net one penalty', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([PENALTY_DIE, PENALTY_DIE, BONUS_DIE]);
      expect(nets).toEqual([{ kind: 'extra-die', keep: 'worst', count: 1 }]);
    });
  });

  describe('no stacking beyond cancel (equal counts fully cancel)', () => {
    it('two advantages + two disadvantages → normal (empty result)', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE, ADVANTAGE, DISADVANTAGE, DISADVANTAGE]);
      expect(nets).toEqual([]);
    });
  });

  describe('bug #249: two different kinds with net≠0 must both be returned, order-independent', () => {
    it('advantage (keep) + bonus die (extra-die) → both returned', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE, BONUS_DIE]);
      expect(nets).toContainEqual({ kind: 'keep', keep: 'best', count: 1 });
      expect(nets).toContainEqual({ kind: 'extra-die', keep: 'best', count: 1 });
      expect(nets).toHaveLength(2);
    });

    it('reversed input order produces the same set of results', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const forward = resolveNetModifier([ADVANTAGE, BONUS_DIE]);
      const reversed = resolveNetModifier([BONUS_DIE, ADVANTAGE]);
      expect(new Set(forward.map((n) => JSON.stringify(n)))).toEqual(
        new Set(reversed.map((n) => JSON.stringify(n))),
      );
    });
  });

  describe('passive ± adjustment', () => {
    it('advantage → passive +5', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE]);
      expect(resolvePassiveAdjustment(nets, 5)).toBe(5);
    });

    it('disadvantage → passive -5', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const nets = resolveNetModifier([DISADVANTAGE]);
      expect(resolvePassiveAdjustment(nets, 5)).toBe(-5);
    });

    it('normal (no net modifier) → passive adjustment 0', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const nets = resolveNetModifier([ADVANTAGE, DISADVANTAGE]);
      expect(resolvePassiveAdjustment(nets, 5)).toBe(0);
    });
  });

  describe('no eval()', () => {
    it('roll-modifier-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/roll-modifier-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
