// @vitest-environment node
// M13-S03: Overlay-Resolver (Basis ⊕ aktive Module)
// See: https://github.com/Djimon/WorldBrain/issues/238
//
// Note: pure resolver over declaration objects (no new UI component or
// DatabaseLike consumer in this story's Unit-Tests bullet) — the generic
// "database prop typed as DatabaseLike" boilerplate does not map to a
// concrete artifact here; not tested to avoid fabricating a non-existent
// requirement (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

async function getOverlayResolver() { return import('../src/services/overlay-resolver'); }

describe('M13-S03 overlay resolver (base ⊕ active modules)', () => {
  describe('Gritty-Rest overshadows transition:long_rest', () => {
    it('a single active module patching transition:long_rest wins over the base', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = {
        'transition:long_rest': { on: 'long_rest', action: { type: 'reset' } },
      };
      const grittyRest = {
        id: 'gritty_realism',
        overrides: [
          { target: 'transition:long_rest', op: 'replace' as const, value: { on: 'long_rest', action: { type: 'refill_to', amount: '1d4' } } },
        ],
      };
      const result = resolveOverlay(base, [grittyRest]);
      expect(result.effective['transition:long_rest']).toEqual({ on: 'long_rest', action: { type: 'refill_to', amount: '1d4' } });
    });

    it('no conflict is flagged when only one module touches the target', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = { 'transition:long_rest': { on: 'long_rest', action: { type: 'reset' } } };
      const grittyRest = {
        id: 'gritty_realism',
        overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: {} }],
      };
      const result = resolveOverlay(base, [grittyRest]);
      expect(result.conflicts).toEqual([]);
    });
  });

  describe('two modules on bands:attack → order decides, conflict flagged', () => {
    it('the later module in the stack wins (last-wins per target ID)', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = { 'bands:attack': { crit: { when: 'roll >= 20' } } };
      const critModuleA = {
        id: 'crit_19_20',
        overrides: [{ target: 'bands:attack', op: 'patch' as const, value: { crit: { when: 'roll >= 19' } } }],
      };
      const critModuleB = {
        id: 'crit_18_20',
        overrides: [{ target: 'bands:attack', op: 'patch' as const, value: { crit: { when: 'roll >= 18' } } }],
      };
      const result = resolveOverlay(base, [critModuleA, critModuleB]);
      expect((result.effective['bands:attack'] as { crit: { when: string } }).crit.when).toBe('roll >= 18');
    });

    it('two modules touching the same target ID are flagged as a conflict', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = { 'bands:attack': { crit: { when: 'roll >= 20' } } };
      const critModuleA = {
        id: 'crit_19_20',
        overrides: [{ target: 'bands:attack', op: 'patch' as const, value: { crit: { when: 'roll >= 19' } } }],
      };
      const critModuleB = {
        id: 'crit_18_20',
        overrides: [{ target: 'bands:attack', op: 'patch' as const, value: { crit: { when: 'roll >= 18' } } }],
      };
      const result = resolveOverlay(base, [critModuleA, critModuleB]);
      expect(result.conflicts).toContain('bands:attack');
    });
  });

  describe('output shape = same declaration map as a base plugin (overlay-agnostic for M9/M12 consumers)', () => {
    it('untouched base declarations pass through unchanged', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = {
        'transition:long_rest': { on: 'long_rest', action: { type: 'reset' } },
        'resource:hero_points': { seedFrom: '0', max: '3' },
      };
      const grittyRest = {
        id: 'gritty_realism',
        overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: {} }],
      };
      const result = resolveOverlay(base, [grittyRest]);
      expect(result.effective['resource:hero_points']).toEqual({ seedFrom: '0', max: '3' });
    });

    it('an "add" override introduces a new declaration not present in the base', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = {};
      const heroPointsModule = {
        id: 'hero_points_module',
        overrides: [{ target: 'resource:hero_points', op: 'add' as const, value: { seedFrom: '0', max: '3' } }],
      };
      const result = resolveOverlay(base, [heroPointsModule]);
      expect(result.effective['resource:hero_points']).toEqual({ seedFrom: '0', max: '3' });
    });

    it('a "remove" override deletes a base declaration from the effective set', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = { 'formula:ac_total': '10 + dex_mod' };
      const noArmorModule = {
        id: 'no_armor_class',
        overrides: [{ target: 'formula:ac_total', op: 'remove' as const }],
      };
      const result = resolveOverlay(base, [noArmorModule]);
      expect(result.effective['formula:ac_total']).toBeUndefined();
    });
  });

  describe('determinism: same inputs → same output', () => {
    it('calling resolveOverlay twice with the same inputs yields equal results', async () => {
      const { resolveOverlay } = await getOverlayResolver();
      const base = { 'transition:long_rest': { on: 'long_rest', action: { type: 'reset' } } };
      const grittyRest = {
        id: 'gritty_realism',
        overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: { on: 'long_rest', action: { type: 'refill_to', amount: '1d4' } } }],
      };
      const first = resolveOverlay(base, [grittyRest]);
      const second = resolveOverlay(base, [grittyRest]);
      expect(first).toEqual(second);
    });
  });

  describe('no eval()', () => {
    it('overlay-resolver.ts does not use eval()', () => {
      const src = readFileSync('src/services/overlay-resolver.ts', 'utf-8');
      expect(src).not.toMatch(/\beval\s*\(/);
    });
  });
});
