// @vitest-environment node
// M12-S02: Success-Bands / Degrees of Success
// See: https://github.com/Djimon/WorldBrain/issues/227
//
// Note: pure resolver over M9 field-engine scalars (no new UI component or
// DatabaseLike consumer in this story's Unit-Tests bullet) — the generic
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getBandsResolver() { return import('../src/services/success-bands-resolver'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

const COC_BANDS = [
  { name: 'extreme', when: 'roll <= floor(target / 5)' },
  { name: 'hard', when: 'roll <= floor(target / 2)' },
  { name: 'regular', when: 'roll <= target' },
  { name: 'fumble', when: 'roll >= 96' },
  { name: 'fail', when: 'roll > target' },
];

const PF2E_BANDS = [
  { name: 'crit-success', when: 'roll >= target + 10' },
  { name: 'crit-failure', when: 'roll <= target - 10' },
  { name: 'success', when: 'roll >= target' },
  { name: 'failure', when: 'roll < target' },
];

describe('M12-S02 success bands / degrees of success', () => {
  describe('CoC 5-tier bands (Skill 50)', () => {
    it.each([
      [10, 'extreme'],
      [25, 'hard'],
      [50, 'regular'],
      [51, 'fail'],
      [100, 'fumble'],
    ])('roll %i against skill 50 → %s', async (roll, expected) => {
      const { classifyBand } = await getBandsResolver();
      expect(classifyBand(COC_BANDS, { roll, target: 50 })).toBe(expected);
    });
  });

  describe('PF2e 4-tier bands (DC 20)', () => {
    it.each([
      [30, 'crit-success'],
      [20, 'success'],
      [11, 'failure'],
      [10, 'crit-failure'],
    ])('roll %i against DC 20 → %s', async (roll, expected) => {
      const { classifyBand } = await getBandsResolver();
      expect(classifyBand(PF2E_BANDS, { roll, target: 20 })).toBe(expected);
    });
  });

  describe('nat-20/nat-1 step-shift, clamped at bounds', () => {
    it('shift +1 moves one band toward better outcome', async () => {
      const { applyBandShift } = await getBandsResolver();
      const order = ['crit-failure', 'failure', 'success', 'crit-success'];
      expect(applyBandShift(order, 'failure', 1)).toBe('success');
    });

    it('shift is clamped at the best band (no overflow)', async () => {
      const { applyBandShift } = await getBandsResolver();
      const order = ['crit-failure', 'failure', 'success', 'crit-success'];
      expect(applyBandShift(order, 'crit-success', 1)).toBe('crit-success');
    });

    it('shift is clamped at the worst band (no underflow)', async () => {
      const { applyBandShift } = await getBandsResolver();
      const order = ['crit-failure', 'failure', 'success', 'crit-success'];
      expect(applyBandShift(order, 'crit-failure', -1)).toBe('crit-failure');
    });
  });

  describe('error handling: no band matches / broken config → "—"', () => {
    it('no matching band → "—", not a crash', async () => {
      const { classifyBand } = await getBandsResolver();
      const bands = [{ name: 'only-band', when: 'roll >= 200' }];
      expect(() => classifyBand(bands, { roll: 10, target: 50 })).not.toThrow();
      expect(classifyBand(bands, { roll: 10, target: 50 })).toBe('—');
    });

    it('malformed "when" expression → "—"', async () => {
      const { classifyBand } = await getBandsResolver();
      const bands = [{ name: 'broken', when: '(((' }];
      expect(classifyBand(bands, { roll: 10, target: 50 })).toBe('—');
    });
  });

  describe('stable ID (M12-Decision 12)', () => {
    it('makeStableId("bands", "attack") → "bands:attack"', async () => {
      const { makeStableId } = await getRegistry();
      expect(makeStableId('bands', 'attack')).toBe('bands:attack');
    });
  });

  describe('no eval()', () => {
    it('success-bands-resolver.ts does not use eval()', () => {
      const src = readFileSync('src/services/success-bands-resolver.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
