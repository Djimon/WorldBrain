// @vitest-environment node
// M13-S02: House-Rule-Modul als Overlay-Plugin
// See: https://github.com/Djimon/WorldBrain/issues/237
//
// Note: pure manifest-shape validator (no new UI component in this story's
// Unit-Tests bullet) — the generic "database prop typed as DatabaseLike"
// boilerplate does not map to a concrete artifact here; not tested to avoid
// fabricating a non-existent requirement (AGENTS.md: no extrapolation).

import { beforeEach, describe, expect, it } from 'vitest';

async function getOverlayLoader() { return import('../src/services/overlay-plugin-loader'); }
async function getRegistry() { return import('../src/services/plugin-declaration-registry'); }

describe('M13-S02 house-rule module as overlay plugin', () => {
  beforeEach(async () => {
    const { clearRegistry } = await getRegistry();
    clearRegistry('dnd5e_srd');
  });

  describe('manifest shape: overlays declares the base system', () => {
    it('a manifest without "overlays" is not a valid overlay module', async () => {
      const { validateOverlayManifest } = await getOverlayLoader();
      const manifest = { id: 'gritty_realism', overlays: '' };
      expect(validateOverlayManifest(manifest).valid).toBe(false);
    });
  });

  // Target-ID existence is validated by overlay-conflict-service.validateModuleTargets
  // against the base-system declaration registry (the loader's own
  // validateOverlayManifest is shape-only — see its header comment).
  describe('overlay module loads and validates target IDs against the base system', () => {
    async function getConflictService() { return import('../src/services/overlay-conflict-service'); }

    it('an overlay with all-existing target IDs is valid', async () => {
      const { registerDeclaration, listDeclarationIds } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'transition', 'long_rest', { on: 'long_rest', action: { type: 'reset' } });
      const { validateModuleTargets } = await getConflictService();
      const knownIds = new Set(listDeclarationIds('dnd5e_srd'));
      const mod = {
        id: 'gritty_realism',
        overlays: 'dnd5e_srd',
        overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: {} }],
      };
      expect(validateModuleTargets(mod, knownIds)).toHaveLength(0);
    });

    it('an overlay targeting a nonexistent base ID is rejected', async () => {
      const { registerDeclaration, listDeclarationIds } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'transition', 'long_rest', { on: 'long_rest', action: { type: 'reset' } });
      const { validateModuleTargets } = await getConflictService();
      const knownIds = new Set(listDeclarationIds('dnd5e_srd'));
      const mod = {
        id: 'broken_overlay',
        overlays: 'dnd5e_srd',
        overrides: [{ target: 'transition:nonexistent', op: 'patch' as const, value: {} }],
      };
      const errors = validateModuleTargets(mod, knownIds);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.join(' ')).toContain('transition:nonexistent');
    });

    it('a new target under a known prefix does not require the base ID to pre-exist (prefix-only validation)', async () => {
      const { validateModuleTargets } = await getConflictService();
      const mod = {
        id: 'hero_points_module',
        overlays: 'dnd5e_srd',
        overrides: [{ target: 'resource:hero_points', op: 'patch' as const, value: {} }],
      };
      // No knownIds supplied → prefix-only check; a brand-new resource is allowed.
      expect(validateModuleTargets(mod)).toHaveLength(0);
    });
  });
});
