// @vitest-environment node
// M11-S01: i18n foundation — react-i18next, locale loader, language switch.
// See: https://github.com/Djimon/WorldBrain/issues/209

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES_ROOT = 'src/locales';
const REQUIRED_NAMESPACES = ['common', 'nav', 'entity', 'map', 'session'];
const REQUIRED_LANGS = ['en', 'de'];

describe('M11-S01 i18n foundation', () => {
  describe('dependency', () => {
    it('react-i18next is listed in package.json dependencies', () => {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as Record<string, Record<string, string>>;
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps).toHaveProperty('react-i18next');
    });

    it('i18next is listed in package.json dependencies', () => {
      const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as Record<string, Record<string, string>>;
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      expect(allDeps).toHaveProperty('i18next');
    });
  });

  describe('init module', () => {
    it('src/i18n.ts exists and is importable', async () => {
      const mod = await import('../src/i18n');
      expect(mod).toBeDefined();
    });

    it('src/i18n.ts exports a configured i18next instance as default', async () => {
      const mod = await import('../src/i18n');
      expect(mod.default).toBeDefined();
      expect(typeof mod.default.t).toBe('function');
    });

    it('i18next instance is initialized (isInitialized = true)', async () => {
      const mod = await import('../src/i18n');
      expect(mod.default.isInitialized).toBe(true);
    });
  });

  describe('locale file structure', () => {
    it.each(REQUIRED_LANGS)('src/locales/%s/ directory exists', (lang) => {
      expect(existsSync(`${LOCALES_ROOT}/${lang}`)).toBe(true);
    });

    it.each(REQUIRED_NAMESPACES)('en/%s.json locale file exists', (ns) => {
      expect(existsSync(`${LOCALES_ROOT}/en/${ns}.json`)).toBe(true);
    });

    it.each(REQUIRED_NAMESPACES)('de/%s.json locale file exists', (ns) => {
      expect(existsSync(`${LOCALES_ROOT}/de/${ns}.json`)).toBe(true);
    });

    it('all locale JSON files are valid JSON', () => {
      for (const lang of REQUIRED_LANGS) {
        for (const ns of REQUIRED_NAMESPACES) {
          const path = `${LOCALES_ROOT}/${lang}/${ns}.json`;
          if (existsSync(path)) {
            expect(() => JSON.parse(readFileSync(path, 'utf-8')), `${path} must be valid JSON`).not.toThrow();
          }
        }
      }
    });
  });

  describe('fallback behavior', () => {
    it('missing key returns the key string, not an empty string', async () => {
      const { default: i18n } = await import('../src/i18n');
      const result = i18n.t('__nonexistent_key_xyz__');
      expect(result).toBe('__nonexistent_key_xyz__');
      expect(result).not.toBe('');
    });

    it('configured fallback language is "en"', async () => {
      const { default: i18n } = await import('../src/i18n');
      const options = i18n.options;
      expect(options.fallbackLng).toBe('en');
    });
  });

  describe('language switching', () => {
    it('i18next supports changeLanguage() without app reload', async () => {
      const { default: i18n } = await import('../src/i18n');
      expect(typeof i18n.changeLanguage).toBe('function');
      await expect(i18n.changeLanguage('en')).resolves.not.toThrow();
    });

    it('switching to "de" resolves without error', async () => {
      const { default: i18n } = await import('../src/i18n');
      await expect(i18n.changeLanguage('de')).resolves.not.toThrow();
      await i18n.changeLanguage('en'); // restore
    });
  });
});
