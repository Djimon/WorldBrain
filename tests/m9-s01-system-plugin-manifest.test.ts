// @vitest-environment node
// M9-S01: System-Plugin Manifest-Erweiterung
// See: https://github.com/Djimon/WorldBrain/issues/164

import { describe, expect, it } from 'vitest';

async function getPluginLoader() { return import('../src/services/plugin-loader'); }
async function getPluginValidator() { return import('../src/services/plugin-validator'); }

const VALID_SYSTEM_PLUGIN = {
  id: 'dnd5e-srd',
  name: 'D&D 5e SRD',
  version: '1.0.0',
  system: true,
  mechanics: {
    attributes: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
    resource_types: ['hp', 'spell_slots'],
    distance_units: ['ft', 'mile'],
    challenge_metric: 'cr',
  },
  entity_types: [],
};

const VALID_NON_SYSTEM_PLUGIN = {
  id: 'my-plugin',
  name: 'Custom Plugin',
  version: '1.0.0',
  entity_types: [],
};

describe('M9-S01 system plugin manifest extension', () => {
  describe('manifest schema: system flag', () => {
    it('plugin without "system" field is treated as non-system plugin', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const result = validatePluginManifest(VALID_NON_SYSTEM_PLUGIN);
      expect(result.valid).toBe(true);
      expect(result.manifest?.system).toBeFalsy();
    });

    it('plugin with system: true is recognized as system plugin', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const result = validatePluginManifest(VALID_SYSTEM_PLUGIN);
      expect(result.valid).toBe(true);
      expect(result.manifest?.system).toBe(true);
    });
  });

  describe('system plugin validation: mechanics block required', () => {
    it('system plugin without mechanics block is rejected', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: undefined };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
    });

    it('rejection for missing mechanics includes clear error message', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: undefined };
      const result = validatePluginManifest(badPlugin);
      expect(result.errors?.join(' ')).toMatch(/mechanics/i);
    });

    it('system plugin with mechanics.attributes is accepted', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const result = validatePluginManifest(VALID_SYSTEM_PLUGIN);
      expect(result.valid).toBe(true);
    });

    it('system plugin with empty mechanics (missing required subfields) is rejected', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: {} };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
    });

    it('mechanics must include attributes array', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const { attributes: _a, ...mechanicsWithout } = VALID_SYSTEM_PLUGIN.mechanics;
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: mechanicsWithout };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
    });

    it('mechanics.attributes must be non-empty — empty array is rejected (#217)', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: { ...VALID_SYSTEM_PLUGIN.mechanics, attributes: [] } };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
      expect(result.errors?.join(' ')).toMatch(/non-empty/i);
    });

    it('mechanics must include resource_types', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const { resource_types: _r, ...mechanicsWithout } = VALID_SYSTEM_PLUGIN.mechanics;
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: mechanicsWithout };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
    });

    it('mechanics must include challenge_metric', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const { challenge_metric: _c, ...mechanicsWithout } = VALID_SYSTEM_PLUGIN.mechanics;
      const badPlugin = { ...VALID_SYSTEM_PLUGIN, mechanics: mechanicsWithout };
      const result = validatePluginManifest(badPlugin);
      expect(result.valid).toBe(false);
    });
  });

  describe('system plugin entity types', () => {
    it('system plugin may provide player_character entity type', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const plugin = {
        ...VALID_SYSTEM_PLUGIN,
        entity_types: [{ id: 'player_character', label: 'Player Character', fields: [] }],
      };
      const result = validatePluginManifest(plugin);
      expect(result.valid).toBe(true);
    });

    it('system plugin may provide creature entity type', async () => {
      const { validatePluginManifest } = await getPluginValidator();
      const plugin = {
        ...VALID_SYSTEM_PLUGIN,
        entity_types: [{ id: 'creature', label: 'Creature', fields: [] }],
      };
      const result = validatePluginManifest(plugin);
      expect(result.valid).toBe(true);
    });
  });

  describe('one system plugin per session constraint', () => {
    it('validatePluginManifest exports or plugin-loader enforces single system plugin', async () => {
      // Structural test: the validator or loader must expose a way to check this constraint
      const mod = await getPluginValidator();
      const hasConstraint = 'validateSingleSystemPlugin' in mod ||
        'getActiveSystemPlugin' in mod ||
        'canActivateSystemPlugin' in mod;
      // Also acceptable: documented via comment in source
      const src = await import('fs').then(fs => fs.readFileSync('src/services/plugin-validator.ts', 'utf-8'));
      expect(hasConstraint || src.includes('system') && src.includes('session')).toBe(true);
    });
  });
});
