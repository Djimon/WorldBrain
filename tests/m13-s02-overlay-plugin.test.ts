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

  describe('overlay module loads and validates target IDs against the base system', () => {
    it('an overlay with all-existing target IDs is valid', async () => {
      const { registerDeclaration } = await getRegistry();
      registerDeclaration('dnd5e_srd', 'transition', 'long_rest', { on: 'long_rest', action: { type: 'reset' } });
      const { validateOverlayManifest } = await getOverlayLoader();
      const manifest = {
        id: 'gritty_realism',
        overlays: 'dnd5e_srd',
        type: 'overlay' as const,
        overrides: [{ target: 'transition:long_rest', op: 'replace' as const, value: {} }],
      };
      const result = validateOverlayManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it('an overlay targeting a nonexistent base ID is rejected', async () => {
      const { validateOverlayManifest } = await getOverlayLoader();
      const manifest = {
        id: 'broken_overlay',
        overlays: 'dnd5e_srd',
        type: 'overlay' as const,
        overrides: [{ target: 'transition:nonexistent', op: 'patch' as const, value: {} }],
      };
      const result = validateOverlayManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.join(' ')).toContain('transition:nonexistent');
    });

    it('an "add" override entry does not require the target to pre-exist', async () => {
      const { validateOverlayManifest } = await getOverlayLoader();
      const manifest = {
        id: 'hero_points_module',
        overlays: 'dnd5e_srd',
        type: 'overlay' as const,
        overrides: [{ target: 'resource:hero_points', op: 'add' as const, value: {} }],
      };
      expect(validateOverlayManifest(manifest).valid).toBe(true);
    });
  });
});
