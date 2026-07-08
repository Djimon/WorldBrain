// @vitest-environment node
// M13-S01: Override-Entry-Modell & stabile Ziel-IDs
// See: https://github.com/Djimon/WorldBrain/issues/236
//
// Note: pure resolver over declaration objects + the registry (no new UI
// component in this story's Unit-Tests bullet) — the generic "database prop
// typed as DatabaseLike" boilerplate does not map to a concrete artifact
// here; not tested to avoid fabricating a non-existent requirement
// (AGENTS.md: no extrapolation).

import { describe, expect, it, beforeEach } from 'vitest';

async function getOverrideEntry() { return import('../src/services/override-entry'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

describe('M13-S01 override entry model & stable target IDs', () => {
  describe('patch: merges only the specified fields', () => {
    it('patching bands:attack changes only the crit threshold, preserving other bands', async () => {
      const { applyOverrideEntry } = await getOverrideEntry();
      const base = {
        bands: [{ name: 'success', when: 'roll >= target' }],
        crit: { when: 'roll >= 20' },
      };
      const entry = { target: 'bands:attack', op: 'patch' as const, value: { crit: { when: 'roll >= 19' } } };
      const result = applyOverrideEntry(base, entry) as typeof base;
      expect(result.crit.when).toBe('roll >= 19');
      expect(result.bands).toEqual(base.bands);
    });
  });

  describe('replace: replaces the whole declaration', () => {
    it('replacing transition:long_rest ignores the base entirely', async () => {
      const { applyOverrideEntry } = await getOverrideEntry();
      const base = { on: 'long_rest', action: { type: 'reset' } };
      const replacement = { on: 'long_rest', action: { type: 'refill_to_max', max: 10 } };
      const entry = { target: 'transition:long_rest', op: 'replace' as const, value: replacement };
      expect(applyOverrideEntry(base, entry)).toEqual(replacement);
    });
  });

  describe('remove: removes the declaration', () => {
    it('remove returns undefined regardless of base content', async () => {
      const { applyOverrideEntry } = await getOverrideEntry();
      const entry = { target: 'formula:ac_total', op: 'remove' as const };
      expect(applyOverrideEntry({ formula: 'x' }, entry)).toBeUndefined();
    });
  });

  describe('add: introduces a new declaration', () => {
    it('add returns the value as-is when no base declaration exists', async () => {
      const { applyOverrideEntry } = await getOverrideEntry();
      const entry = { target: 'resource:hero_points', op: 'add' as const, value: { seedFrom: '0', max: '3' } };
      expect(applyOverrideEntry(undefined, entry)).toEqual({ seedFrom: '0', max: '3' });
    });
  });

  describe('target ID validation against the M9/M12 declaration registry (Decision 6)', () => {
    beforeEach(async () => {
      const { clearRegistry } = await getRegistry();
      clearRegistry('dnd5e_srd');
    });

    it('an unknown target ID for a non-add op produces a clear error', async () => {
      const { validateOverrideTargets } = await getOverrideEntry();
      const entries = [{ target: 'transition:nonexistent', op: 'patch' as const, value: {} }];
      const errors = validateOverrideTargets(entries, 'dnd5e_srd');
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('transition:nonexistent');
    });

    it('a known target ID (registered) passes validation', async () => {
      const { registerDeclaration } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'transition', 'long_rest', { on: 'long_rest', action: { type: 'reset' } });
      const { validateOverrideTargets } = await getOverrideEntry();
      const entries = [{ target: 'transition:long_rest', op: 'patch' as const, value: {} }];
      expect(validateOverrideTargets(entries, 'dnd5e_srd')).toEqual([]);
    });

    it('an "add" op does not require the target to already exist', async () => {
      const { validateOverrideTargets } = await getOverrideEntry();
      const entries = [{ target: 'resource:hero_points', op: 'add' as const, value: {} }];
      expect(validateOverrideTargets(entries, 'dnd5e_srd')).toEqual([]);
    });
  });
});
