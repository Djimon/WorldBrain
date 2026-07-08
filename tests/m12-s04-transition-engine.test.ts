// @vitest-environment node
// M12-S04: Reset- & Zustands-Übergangs-Phasen
// See: https://github.com/Djimon/WorldBrain/issues/229
//
// Note: pure resolver over session-state values passed by the caller (no new
// UI component in this story's Unit-Tests bullet) — the generic "database
// prop typed as DatabaseLike" boilerplate does not map to a concrete
// artifact here; not tested to avoid fabricating a non-existent requirement
// (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getTransitionEngine() { return import('../src/services/transition-engine'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

describe('M12-S04 reset & state-transition phases', () => {
  describe('appliesOnTrigger', () => {
    it('matches when descriptor.on equals the trigger', async () => {
      const { appliesOnTrigger } = await getTransitionEngine();
      expect(appliesOnTrigger({ on: 'long_rest', action: { type: 'reset' } }, 'long_rest')).toBe(true);
    });

    it('does not match a different trigger', async () => {
      const { appliesOnTrigger } = await getTransitionEngine();
      expect(appliesOnTrigger({ on: 'long_rest', action: { type: 'reset' } }, 'turn_end')).toBe(false);
    });
  });

  describe('Long Rest: spell_slots_used_* → 0 (reset)', () => {
    it('reset sets the value to 0 regardless of current', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'long_rest' as const, action: { type: 'reset' as const } };
      expect(applyTransition(descriptor, 3, {})).toBe(0);
    });
  });

  describe('Long Rest: Exhaustion −1 (decrement)', () => {
    it('decrement reduces the current value by 1', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'long_rest' as const, action: { type: 'decrement' as const, amount: 1 } };
      expect(applyTransition(descriptor, 2, {})).toBe(1);
    });

    it('decrement does not go below 0', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'long_rest' as const, action: { type: 'decrement' as const, amount: 1 } };
      expect(applyTransition(descriptor, 0, {})).toBe(0);
    });
  });

  describe('turn_end: frightened decrements by 1', () => {
    it('applies decrement on turn_end trigger', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'turn_end' as const, action: { type: 'decrement' as const, amount: 1 } };
      expect(applyTransition(descriptor, 3, {})).toBe(2);
    });
  });

  describe('downtime: CoC skill-improvement applies 1d10 only when condition is met', () => {
    it('condition met (delivered roll > skill) → skill increases by the delivered die value', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = {
        on: 'downtime' as const,
        action: { type: 'apply_dice' as const, dice: '1d10', condition: 'roll > skill', deliveredRoll: 6 },
      };
      // skill = 40, delivered improvement-check roll = 55 (> 40) → apply +6
      expect(applyTransition(descriptor, 40, { skill: 40, roll: 55 })).toBe(46);
    });

    it('condition not met (delivered roll <= skill) → value unchanged', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = {
        on: 'downtime' as const,
        action: { type: 'apply_dice' as const, dice: '1d10', condition: 'roll > skill', deliveredRoll: 6 },
      };
      expect(applyTransition(descriptor, 40, { skill: 40, roll: 30 })).toBe(40);
    });
  });

  describe('refill_to_max / refill_to / set', () => {
    it('refill_to_max sets the value to the given max', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'long_rest' as const, action: { type: 'refill_to_max' as const, max: 5 } };
      expect(applyTransition(descriptor, 0, {})).toBe(5);
    });

    it('set applies a formula against entity fields', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'session_start' as const, action: { type: 'set' as const, formula: 'level' } };
      expect(applyTransition(descriptor, 0, { level: 3 })).toBe(3);
    });
  });

  describe('error handling: malformed formula-based action does not crash', () => {
    it('set with an unresolvable formula returns null, not a throw', async () => {
      const { applyTransition } = await getTransitionEngine();
      const descriptor = { on: 'session_start' as const, action: { type: 'set' as const, formula: 'nonexistent_field' } };
      expect(() => applyTransition(descriptor, 0, {})).not.toThrow();
      expect(applyTransition(descriptor, 0, {})).toBeNull();
    });
  });

  describe('stable ID (M12-Decision 12)', () => {
    it('makeStableId("transition", "long_rest") → "transition:long_rest"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('transition', 'long_rest')).toBe('transition:long_rest');
    });
  });

  describe('no eval()', () => {
    it('transition-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/transition-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
