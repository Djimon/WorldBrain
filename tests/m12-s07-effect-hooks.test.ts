// @vitest-environment node
// M12-S07: Ergebnis→Effekt-Hooks & gated Dice
// See: https://github.com/Djimon/WorldBrain/issues/232
//
// Note: pure resolver over declared effect descriptors (no new UI component
// or DatabaseLike consumer in this story's Unit-Tests bullet) — the generic
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getHookEngine() { return import('../src/services/hook-engine'); }
async function getResourceEngine() { return import('../src/services/resource-engine'); }

const SANITY_DESCRIPTOR = {
  seedFrom: 'pow',
  max: '99 - mythos',
  min: 0,
  triggers: [
    { when: 'delta_single <= -5', set_flag: 'temporaryInsanity' },
  ],
};

describe('M12-S07 outcome→effect hooks & gated dice', () => {
  describe('Hope-Gain at "with Hope" (Daggerheart)', () => {
    it('resolves the gain(hope, 1) effect for the "with_hope" outcome', async () => {
      const { resolveHookEffects } = await getHookEngine();
      const hooks = { with_hope: [{ verb: 'gain' as const, resource: 'hope', amount: '1' }] };
      const effects = resolveHookEffects(hooks, 'with_hope');
      expect(effects).toEqual([{ verb: 'gain', resource: 'hope', amount: '1' }]);
    });

    it('a crit hook can gain hope and clear stress in one outcome', async () => {
      const { resolveHookEffects } = await getHookEngine();
      const hooks = {
        crit: [
          { verb: 'gain' as const, resource: 'hope', amount: '1' },
          { verb: 'clear' as const, resource: 'stress', amount: '1' },
        ],
      };
      expect(resolveHookEffects(hooks, 'crit')).toHaveLength(2);
    });

    it('an outcome with no hooks resolves to an empty list, not a crash', async () => {
      const { resolveHookEffects } = await getHookEngine();
      expect(() => resolveHookEffects({}, 'regular')).not.toThrow();
      expect(resolveHookEffects({}, 'regular')).toEqual([]);
    });
  });

  describe('effect amount resolution', () => {
    it('a plain formula amount resolves via the M9 engine', async () => {
      const { resolveEffectAmount } = await getHookEngine();
      const effect = { verb: 'gain' as const, resource: 'hope', amount: '1' };
      expect(resolveEffectAmount(effect, {})).toBe(1);
    });

    it('a dice-notation amount requires an already-delivered roll (Decision 2)', async () => {
      const { resolveEffectAmount } = await getHookEngine();
      const effect = { verb: 'spend' as const, resource: 'sanity', amount: '1d6' };
      expect(resolveEffectAmount(effect, {}, 4)).toBe(4);
    });

    it('a dice-notation amount without a delivered roll → null, not a crash', async () => {
      const { resolveEffectAmount } = await getHookEngine();
      const effect = { verb: 'spend' as const, resource: 'sanity', amount: '1d6' };
      expect(() => resolveEffectAmount(effect, {})).not.toThrow();
      expect(resolveEffectAmount(effect, {})).toBeNull();
    });
  });

  describe('CoC SAN spend(1d6) on failed roll cascades into resource threshold trigger', () => {
    it('spending 5 sanity (delivered 1d6=5) sets temporaryInsanity via the resource primitive', async () => {
      const { resolveEffectAmount } = await getHookEngine();
      const { applyResourceChange } = await getResourceEngine();
      const spendEffect = { verb: 'spend' as const, resource: 'sanity', amount: '1d6' };
      const amount = resolveEffectAmount(spendEffect, {}, 5);
      const result = applyResourceChange(
        SANITY_DESCRIPTOR,
        { pow: 60, mythos: 0 },
        { value: 60, sessionStart: 60, deltaSession: 0 },
        -(amount as number),
      );
      expect(result.flags).toContain('temporaryInsanity');
    });
  });

  describe('gated dice: onSuccess/onFailure payload', () => {
    it('resolves the onFailure payload when the outcome is failure', async () => {
      const { resolveGatedPayload } = await getHookEngine();
      const descriptor = { onSuccess: '0', onFailure: '1d6' };
      expect(resolveGatedPayload(descriptor, 'failure')).toBe('1d6');
    });

    it('resolves the onSuccess payload when the outcome is success', async () => {
      const { resolveGatedPayload } = await getHookEngine();
      const descriptor = { onSuccess: '0', onFailure: '1d6' };
      expect(resolveGatedPayload(descriptor, 'success')).toBe('0');
    });
  });

  describe('no eval()', () => {
    it('hook-engine.ts does not use eval()', () => {
      const src = readFileSync('src/services/hook-engine.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
