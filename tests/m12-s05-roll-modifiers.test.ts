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
      const net = resolveNetModifier([ADVANTAGE]);
      expect(net.kind).toBe('keep');
      expect(net.keep).toBe('best');
    });
  });

  describe('CoC Bonus die = extra-die pool:tens keep:best', () => {
    it('a single bonus die resolves to extra-die keep-best', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const net = resolveNetModifier([BONUS_DIE]);
      expect(net.kind).toBe('extra-die');
      expect(net.keep).toBe('best');
    });
  });

  describe('pairwise cancel (AC unit test)', () => {
    it('advantage + disadvantage → normal', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const net = resolveNetModifier([ADVANTAGE, DISADVANTAGE]);
      expect(net.kind).toBe('normal');
    });

    it('two penalty dice + one bonus die → net one penalty', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const net = resolveNetModifier([PENALTY_DIE, PENALTY_DIE, BONUS_DIE]);
      expect(net.kind).toBe('extra-die');
      expect(net.keep).toBe('worst');
      expect(net.count).toBe(1);
    });
  });

  describe('no stacking beyond cancel (equal counts fully cancel)', () => {
    it('two advantages + two disadvantages → normal', async () => {
      const { resolveNetModifier } = await getRollModifierEngine();
      const net = resolveNetModifier([ADVANTAGE, ADVANTAGE, DISADVANTAGE, DISADVANTAGE]);
      expect(net.kind).toBe('normal');
    });
  });

  describe('passive ± adjustment', () => {
    it('advantage → passive +5', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const net = resolveNetModifier([ADVANTAGE]);
      expect(resolvePassiveAdjustment(net, 5)).toBe(5);
    });

    it('disadvantage → passive -5', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const net = resolveNetModifier([DISADVANTAGE]);
      expect(resolvePassiveAdjustment(net, 5)).toBe(-5);
    });

    it('normal (no net modifier) → passive adjustment 0', async () => {
      const { resolveNetModifier, resolvePassiveAdjustment } = await getRollModifierEngine();
      const net = resolveNetModifier([ADVANTAGE, DISADVANTAGE]);
      expect(resolvePassiveAdjustment(net, 5)).toBe(0);
    });
  });

  describe('no eval()', () => {
    it('roll-modifier-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/roll-modifier-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
