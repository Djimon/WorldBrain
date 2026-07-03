// @vitest-environment node
// M11-S06: System-Plugin-String-Lokalisierung
// See: https://github.com/Djimon/WorldBrain/issues/214

import { describe, expect, it, beforeEach } from 'vitest';

async function getPluginI18nService() {
  return import('../src/services/plugin-i18n-service');
}

const PLUGIN_ID = 'dnd5e-srd';

const MANIFEST_WITH_LOCALES = {
  id: PLUGIN_ID,
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
  locales: {
    en: {
      'attr.str': 'Strength',
      'attr.dex': 'Dexterity',
      'entity.character': 'Character',
    },
    de: {
      'attr.str': 'Stärke',
      'attr.dex': 'Gewandtheit',
      'entity.character': 'Charakter',
    },
  },
};

const MANIFEST_WITHOUT_LOCALES = {
  id: 'no-locale-plugin',
  name: 'Plugin Without Locales',
  version: '1.0.0',
  entity_types: [],
};

describe('M11-S06 system-plugin string localization', () => {
  describe('registerPluginLocales — service exists', () => {
    it('plugin-i18n-service exports registerPluginLocales', async () => {
      const mod = await getPluginI18nService();
      expect(typeof mod.registerPluginLocales).toBe('function');
    });

    it('registerPluginLocales is async (returns a Promise)', async () => {
      const { registerPluginLocales } = await getPluginI18nService();
      const result = registerPluginLocales(MANIFEST_WITH_LOCALES);
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('AC1: manifest locales block accepted', () => {
    it('manifest with locales block does not throw on registerPluginLocales', async () => {
      const { registerPluginLocales } = await getPluginI18nService();
      await expect(registerPluginLocales(MANIFEST_WITH_LOCALES)).resolves.not.toThrow();
    });

    it('manifest without locales block does not throw (locales optional)', async () => {
      const { registerPluginLocales } = await getPluginI18nService();
      await expect(registerPluginLocales(MANIFEST_WITHOUT_LOCALES)).resolves.not.toThrow();
    });
  });

  describe('AC2: namespace is plugin:<plugin_id>', () => {
    it('getPluginNamespace returns "plugin:<id>" for a given plugin id', async () => {
      const { getPluginNamespace } = await getPluginI18nService();
      expect(getPluginNamespace(PLUGIN_ID)).toBe(`plugin:${PLUGIN_ID}`);
    });

    it('after registration, translation is accessible under plugin:<id> namespace', async () => {
      const { registerPluginLocales, getPluginT } = await getPluginI18nService();
      await registerPluginLocales(MANIFEST_WITH_LOCALES);
      const t = getPluginT(PLUGIN_ID, 'en');
      expect(t('attr.str')).toBe('Strength');
    });

    it('german locale is accessible under same namespace', async () => {
      const { registerPluginLocales, getPluginT } = await getPluginI18nService();
      await registerPluginLocales(MANIFEST_WITH_LOCALES);
      const t = getPluginT(PLUGIN_ID, 'de');
      expect(t('attr.str')).toBe('Stärke');
    });
  });

  describe('AC3: missing plugin translation falls back to canonical string, not Core-en', () => {
    it('missing key returns the key itself (canonical string), not empty string', async () => {
      const { registerPluginLocales, getPluginT } = await getPluginI18nService();
      await registerPluginLocales(MANIFEST_WITH_LOCALES);
      const t = getPluginT(PLUGIN_ID, 'de');
      const result = t('attr.unknown_stat');
      expect(result).toBe('attr.unknown_stat');
      expect(result).not.toBe('');
    });

    it('missing german key does not fall back to Core-en translation', async () => {
      const { registerPluginLocales, getPluginT } = await getPluginI18nService();
      await registerPluginLocales(MANIFEST_WITH_LOCALES);
      const t = getPluginT(PLUGIN_ID, 'de');
      // 'entity.character' only exists in plugin-en, not core-en
      // fallback must be canonical key, not a core namespace value
      const result = t('entity.character');
      // either the German value or the key — never a core-namespace string
      expect(['Charakter', 'entity.character']).toContain(result);
    });
  });

  describe('AC4: homebrew content stays in author language', () => {
    it('plugin without locales block: getPluginT returns canonical key as-is', async () => {
      const { registerPluginLocales, getPluginT } = await getPluginI18nService();
      await registerPluginLocales(MANIFEST_WITHOUT_LOCALES);
      const t = getPluginT('no-locale-plugin', 'de');
      expect(t('my.custom.label')).toBe('my.custom.label');
    });
  });

  describe('AC5: plugin-i18n-service source constraints', () => {
    it('plugin-i18n-service.ts exists', async () => {
      const { readFileSync } = await import('node:fs');
      expect(() => readFileSync('src/services/plugin-i18n-service.ts', 'utf-8')).not.toThrow();
    });
  });
});
