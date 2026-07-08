// @vitest-environment node
// M12-S03: Resource-Primitiv (Cap, Seed, Schwellen-Flags)
// See: https://github.com/Djimon/WorldBrain/issues/228
//
// Note: pure resolver over M9 field-engine scalars + session-scoped state
// passed by the caller (no new UI component in this story's Unit-Tests
// bullet) — the generic "database prop typed as DatabaseLike" boilerplate
// does not map to a concrete artifact here; not tested to avoid fabricating
// a non-existent requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getResourceEngine() { return import('../src/services/resource-engine'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

const SANITY_DESCRIPTOR = {
  seedFrom: 'pow',
  max: '99 - mythos',
  min: 0,
  triggers: [
    { when: 'value == 0', set_flag: 'permanentMadness' },
    { when: 'delta_single <= -5', set_flag: 'temporaryInsanity' },
    { when: 'delta_session <= -(0.2 * session_start)', set_flag: 'indefiniteInsanity' },
  ],
};

const HP_DESCRIPTOR = {
  seedFrom: 'max_hp',
  max: 'max_hp',
  min: 0,
};

describe('M12-S03 resource primitive (cap, seed, threshold flags)', () => {
  describe('seed (P4)', () => {
    it('Sanity seeds from POW', async () => {
      const { seedResource } = await getResourceEngine();
      expect(seedResource(SANITY_DESCRIPTOR, { pow: 60, mythos: 10 })).toBe(60);
    });

    it('HP seeds from max_hp', async () => {
      const { seedResource } = await getResourceEngine();
      expect(seedResource(HP_DESCRIPTOR, { max_hp: 30 })).toBe(30);
    });
  });

  describe('cap enforcement', () => {
    it('Sanity max resolves as 99 - mythos', async () => {
      const { resolveResourceCap } = await getResourceEngine();
      expect(resolveResourceCap(SANITY_DESCRIPTOR, { mythos: 10 })).toBe(89);
    });

    it('applyResourceChange clamps value to the resolved cap', async () => {
      const { applyResourceChange } = await getResourceEngine();
      const result = applyResourceChange(
        HP_DESCRIPTOR,
        { max_hp: 30 },
        { value: 28, sessionStart: 30, deltaSession: -2 },
        10, // healing 10 would overshoot 30
      );
      expect(result.value).toBe(30);
    });
  });

  describe('threshold triggers', () => {
    it('single loss of 5 or more sets temporaryInsanity', async () => {
      const { applyResourceChange } = await getResourceEngine();
      const result = applyResourceChange(
        SANITY_DESCRIPTOR,
        { pow: 60, mythos: 0 },
        { value: 60, sessionStart: 60, deltaSession: 0 },
        -5,
      );
      expect(result.flags).toContain('temporaryInsanity');
    });

    it('cumulative session loss ≥ 1/5 of session_start sets indefiniteInsanity', async () => {
      const { applyResourceChange } = await getResourceEngine();
      // Already at -7 for the session; this -5 brings deltaSession to -12,
      // which is <= -(0.2 * 60) = -12.
      const result = applyResourceChange(
        SANITY_DESCRIPTOR,
        { pow: 60, mythos: 0 },
        { value: 50, sessionStart: 60, deltaSession: -7 },
        -5,
      );
      expect(result.flags).toContain('indefiniteInsanity');
    });

    it('reaching 0 sets permanentMadness', async () => {
      const { applyResourceChange } = await getResourceEngine();
      const result = applyResourceChange(
        SANITY_DESCRIPTOR,
        { pow: 60, mythos: 0 },
        { value: 3, sessionStart: 60, deltaSession: -57 },
        -3,
      );
      expect(result.flags).toContain('permanentMadness');
    });

    it('small loss (< 5) triggers no flags', async () => {
      const { applyResourceChange } = await getResourceEngine();
      const result = applyResourceChange(
        SANITY_DESCRIPTOR,
        { pow: 60, mythos: 0 },
        { value: 60, sessionStart: 60, deltaSession: 0 },
        -2,
      );
      expect(result.flags).toEqual([]);
    });
  });

  describe('error handling: unresolvable cap/seed does not crash', () => {
    it('seedResource returns null for an unresolvable seedFrom', async () => {
      const { seedResource } = await getResourceEngine();
      const badDescriptor = { seedFrom: 'nonexistent_field', max: '10' };
      expect(() => seedResource(badDescriptor, {})).not.toThrow();
      expect(seedResource(badDescriptor, {})).toBeNull();
    });
  });

  describe('stable ID (M12-Decision 12)', () => {
    it('makeStableId("resource", "sanity") → "resource:sanity"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('resource', 'sanity')).toBe('resource:sanity');
    });
  });

  describe('no eval()', () => {
    it('resource-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/resource-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
