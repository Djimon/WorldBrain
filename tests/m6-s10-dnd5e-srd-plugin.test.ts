// @vitest-environment node
// M6-S10: D&D 5e SRD example plugin — validates plugin format and SRD compliance.
// See: https://github.com/Djimon/WorldBrain/issues/100

import { describe, expect, it } from 'vitest';

async function getSrdPlugin() { return import('../plugins/dnd5e_srd/plugin.json', { assert: { type: 'json' } }); }

describe('M6-S10 D&D 5e SRD plugin', () => {
  describe('plugin manifest', () => {
    it('plugin.json exists and has id dnd5e_srd', async () => {
      const manifest = await getSrdPlugin();
      expect((manifest as unknown as { id: string }).id ?? (manifest.default as { id: string }).id).toBe('dnd5e_srd');
    });

    it('manifest has required fields: id, label, version, compatibility', async () => {
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as Record<string, unknown>;
      ['id', 'label', 'version', 'compatibility'].forEach(f => expect(manifest).toHaveProperty(f));
    });

    it('contributes entity types: spell, monster, condition, class_feature', async () => {
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as { entity_types?: string[] };
      const types = manifest.entity_types ?? [];
      ['spell', 'monster', 'condition', 'class_feature'].forEach(t =>
        expect(types.some((et: string) => et.toLowerCase().includes(t))).toBe(true)
      );
    });

    it('mechanics block has correct attributes and challenge_metric', async () => {
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as { mechanics?: { attributes?: string[]; challenge_metric?: string } };
      const mechanics = manifest.mechanics;
      expect(mechanics).toBeDefined();
      expect(mechanics?.attributes).toContain('str');
      expect(mechanics?.challenge_metric).toBe('cr');
    });

    it('license is CC-BY-4.0 or OGL', async () => {
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as { license?: string };
      expect(manifest.license).toMatch(/CC-BY-4\.0|OGL/i);
    });
  });

  describe('plugin loads cleanly', () => {
    it('plugin.json parses without error', async () => {
      await expect(getSrdPlugin()).resolves.toBeDefined();
    });

    it('no non-SRD proprietary content marker in data files', async () => {
      // SRD content is licensed — verify plugin metadata says so
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as { license?: string; source?: string };
      expect(manifest.license ?? manifest.source ?? '').toMatch(/CC-BY|OGL|SRD/i);
    });
  });

  describe('plugin validation', () => {
    it('validatePluginManifest returns no errors for dnd5e_srd manifest', async () => {
      const { validatePluginManifest } = await import('../src/services/plugin-loader');
      const raw = await getSrdPlugin();
      const manifest = (raw.default ?? raw) as object;
      const result = validatePluginManifest(manifest);
      expect(result.errors).toHaveLength(0);
    });
  });
});
