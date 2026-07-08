// @vitest-environment node
// M12-S09: Cross-Character-Resolution (Opposed / Assist)
// See: https://github.com/Djimon/WorldBrain/issues/234
//
// Note: pure comparator over two already-delivered band results (no new UI
// component or DatabaseLike consumer in this story's Unit-Tests bullet) —
// the generic "database prop typed as DatabaseLike" boilerplate does not map
// to a concrete artifact here; not tested to avoid fabricating a
// non-existent requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getOpposedResolution() { return import('../src/services/opposed-resolution'); }
async function getHookEngine() { return import('../src/services/hook-engine'); }

const COC_BAND_ORDER = ['fumble', 'fail', 'regular', 'hard', 'extreme'];

describe('M12-S09 cross-character resolution (opposed / assist)', () => {
  describe('opposed roll: higher band wins (AC unit test)', () => {
    it('attacker extreme vs defender hard → attacker wins', async () => {
      const { resolveOpposed } = await getOpposedResolution();
      const result = resolveOpposed(
        { band: 'extreme', target: 50 },
        { band: 'hard', target: 60 },
        COC_BAND_ORDER,
      );
      expect(result).toBe('attacker');
    });

    it('attacker fail vs defender regular → defender wins', async () => {
      const { resolveOpposed } = await getOpposedResolution();
      const result = resolveOpposed(
        { band: 'fail', target: 50 },
        { band: 'regular', target: 40 },
        COC_BAND_ORDER,
      );
      expect(result).toBe('defender');
    });
  });

  describe('tie-break by target value (AC unit test)', () => {
    it('same band, attacker has higher target → attacker wins', async () => {
      const { resolveOpposed } = await getOpposedResolution();
      const result = resolveOpposed(
        { band: 'regular', target: 60 },
        { band: 'regular', target: 40 },
        COC_BAND_ORDER,
      );
      expect(result).toBe('attacker');
    });

    it('same band, defender has higher target → defender wins', async () => {
      const { resolveOpposed } = await getOpposedResolution();
      const result = resolveOpposed(
        { band: 'regular', target: 40 },
        { band: 'regular', target: 60 },
        COC_BAND_ORDER,
      );
      expect(result).toBe('defender');
    });

    it('same band, same target → genuine tie', async () => {
      const { resolveOpposed } = await getOpposedResolution();
      const result = resolveOpposed(
        { band: 'regular', target: 50 },
        { band: 'regular', target: 50 },
        COC_BAND_ORDER,
      );
      expect(result).toBe('tie');
    });
  });

  describe('resource transfer (Rally/Tag-team) composes from existing hook-engine effects, no new resolver', () => {
    it('a transfer is expressible as spend-on-source + gain-on-target amounts resolving equally', async () => {
      const { resolveEffectAmount } = await getHookEngine();
      const spend = { verb: 'spend' as const, resource: 'hope', amount: '1' };
      const gain = { verb: 'gain' as const, resource: 'stress', amount: '1' };
      expect(resolveEffectAmount(spend, {})).toBe(resolveEffectAmount(gain, {}));
    });
  });

  describe('no eval()', () => {
    it('opposed-resolution.ts does not use eval()', () => {
      const src = readFileSync('src/services/opposed-resolution.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
