// @vitest-environment node
// M12-S01: Roll-Target & Roll-Richtung
// See: https://github.com/Djimon/WorldBrain/issues/226
//
// Note: pure resolver over M9 field-engine scalars (no new UI component or
// DatabaseLike consumer in this story's Unit-Tests bullet) — the generic
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getRollTargetResolver() { return import('../src/services/roll-target-resolver'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

describe('M12-S01 roll-target & roll-direction', () => {
  describe('roll-under (CoC-style: Skill 40)', () => {
    it('roll 40 (== target) → success', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: 'dodge', direction: 'under' as const };
      const result = classifyRoll(descriptor, { dodge: 40 }, 40);
      expect(result).toBe('success');
    });

    it('roll 41 (> target) → failure', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: 'dodge', direction: 'under' as const };
      const result = classifyRoll(descriptor, { dodge: 40 }, 41);
      expect(result).toBe('failure');
    });
  });

  describe('roll-over (D&D-style: DC 15)', () => {
    it('roll 15 (== target) → success', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '15', direction: 'over' as const };
      const result = classifyRoll(descriptor, {}, 15);
      expect(result).toBe('success');
    });

    it('roll 14 (< target) → failure', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '15', direction: 'over' as const };
      const result = classifyRoll(descriptor, {}, 14);
      expect(result).toBe('failure');
    });
  });

  describe('"meet" direction behaves like "over" (roll >= target)', () => {
    it('roll 15 (== target) → success', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '15', direction: 'meet' as const };
      expect(classifyRoll(descriptor, {}, 15)).toBe('success');
    });

    it('roll 14 (< target) → failure', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '15', direction: 'meet' as const };
      expect(classifyRoll(descriptor, {}, 14)).toBe('failure');
    });
  });

  describe('target may be a derived scalar (formula), not just a bare field', () => {
    it('D&D-style dc = 8 + prof + mod resolves and classifies correctly', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '8 + prof + mod', direction: 'over' as const };
      // dc = 8 + 3 + 2 = 13
      expect(classifyRoll(descriptor, { prof: 3, mod: 2 }, 13)).toBe('success');
      expect(classifyRoll(descriptor, { prof: 3, mod: 2 }, 12)).toBe('failure');
    });

    it('resolveRollTarget resolves a formula target to its numeric value', async () => {
      const { resolveRollTarget } = await getRollTargetResolver();
      const descriptor = { target: '8 + prof + mod', direction: 'over' as const };
      expect(resolveRollTarget(descriptor, { prof: 3, mod: 2 })).toBe(13);
    });
  });

  describe('error handling: unresolvable target → "—", not a crash', () => {
    it('unknown field reference in target → "—"', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: 'nonexistent_skill', direction: 'under' as const };
      expect(() => classifyRoll(descriptor, {}, 40)).not.toThrow();
      expect(classifyRoll(descriptor, {}, 40)).toBe('—');
    });

    it('malformed target formula → "—"', async () => {
      const { classifyRoll } = await getRollTargetResolver();
      const descriptor = { target: '(((', direction: 'over' as const };
      expect(classifyRoll(descriptor, {}, 10)).toBe('—');
    });

    it('resolveRollTarget returns null (not a throw) for unresolvable target', async () => {
      const { resolveRollTarget } = await getRollTargetResolver();
      const descriptor = { target: 'nonexistent_skill', direction: 'under' as const };
      expect(() => resolveRollTarget(descriptor, {})).not.toThrow();
      expect(resolveRollTarget(descriptor, {})).toBeNull();
    });
  });

  describe('stable ID (M12-Decision 12 — normative for S02-S10)', () => {
    it('makeStableId("roll", "dodge") → "roll:dodge"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('roll', 'dodge')).toBe('roll:dodge');
    });

    it('a roll-target descriptor is registrable and resolvable under its stable ID', async () => {
      const { registerDeclaration, getDeclaration, clearRegistry } = await getRegistry();
      clearRegistry('coc_srd');
      const descriptor = { target: 'dodge', direction: 'under' as const };
      registerDeclaration('coc_srd', 'roll', 'dodge', descriptor);
      expect(getDeclaration('coc_srd', 'roll:dodge')).toEqual(descriptor);
    });
  });

  describe('no eval()', () => {
    it('roll-target-resolver.ts does not use eval()', () => {
      const src = readFileSync('src/services/roll-target-resolver.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
