// @vitest-environment node
// M11-S07: Translation parity test — every key in en exists in de and vice versa.
// Also verifies locales/README.md documents the custom-language workflow.
// See: https://github.com/Djimon/WorldBrain/issues/215

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES_ROOT = 'src/locales';

function flattenKeys(obj: unknown, prefix = ''): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    flattenKeys(v, prefix ? `${prefix}.${k}` : k),
  );
}

function loadLocaleKeys(lang: string, ns: string): string[] {
  const path = `${LOCALES_ROOT}/${lang}/${ns}.json`;
  if (!existsSync(path)) return [];
  return flattenKeys(JSON.parse(readFileSync(path, 'utf-8')));
}

function getNamespaces(): string[] {
  const enDir = `${LOCALES_ROOT}/en`;
  if (!existsSync(enDir)) return [];
  return readdirSync(enDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''));
}

describe('M11-S07 translation parity', () => {
  describe('locale directory structure', () => {
    it('src/locales/en/ exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/en`)).toBe(true);
    });

    it('src/locales/de/ exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/de`)).toBe(true);
    });

    it('at least one namespace file exists in en/', () => {
      expect(getNamespaces().length).toBeGreaterThan(0);
    });
  });

  describe('key parity: en ↔ de', () => {
    it('every key in en namespaces also exists in de', () => {
      const namespaces = getNamespaces();
      const missing: string[] = [];

      for (const ns of namespaces) {
        const enKeys = loadLocaleKeys('en', ns);
        const deKeys = new Set(loadLocaleKeys('de', ns));
        for (const key of enKeys) {
          if (!deKeys.has(key)) {
            missing.push(`de/${ns}.json missing key: "${key}"`);
          }
        }
      }

      expect(missing, missing.join('\n')).toHaveLength(0);
    });

    it('every key in de namespaces also exists in en (no orphaned de keys)', () => {
      const namespaces = getNamespaces();
      const orphaned: string[] = [];

      for (const ns of namespaces) {
        const enKeys = new Set(loadLocaleKeys('en', ns));
        const deKeys = loadLocaleKeys('de', ns);
        for (const key of deKeys) {
          if (!enKeys.has(key)) {
            orphaned.push(`de/${ns}.json has orphaned key: "${key}" (missing in en)`);
          }
        }
      }

      expect(orphaned, orphaned.join('\n')).toHaveLength(0);
    });

    it('no locale value is an empty string', () => {
      const namespaces = getNamespaces();
      const empty: string[] = [];

      for (const lang of ['en', 'de']) {
        for (const ns of namespaces) {
          const path = `${LOCALES_ROOT}/${lang}/${ns}.json`;
          if (!existsSync(path)) continue;
          const data = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>;
          const keys = flattenKeys(data);
          // Re-read values for leaf nodes
          const obj = JSON.parse(readFileSync(path, 'utf-8')) as unknown;
          function checkEmpty(o: unknown, p = '') {
            if (typeof o === 'string' && o === '') empty.push(`${lang}/${ns}.json["${p}"] is empty`);
            else if (typeof o === 'object' && o !== null) {
              for (const [k, v] of Object.entries(o as Record<string, unknown>)) checkEmpty(v, p ? `${p}.${k}` : k);
            }
          }
          checkEmpty(obj);
        }
      }

      expect(empty, empty.join('\n')).toHaveLength(0);
    });
  });

  describe('README documentation', () => {
    it('src/locales/README.md exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/README.md`)).toBe(true);
    });

    it('README documents the custom-language JSON workflow', () => {
      const readme = readFileSync(`${LOCALES_ROOT}/README.md`, 'utf-8');
      // Must mention namespace files and how to add a language
      expect(readme).toMatch(/namespace/i);
      expect(readme).toMatch(/json/i);
    });

    it('README mentions the appDataDir/locales/ userland folder', () => {
      const readme = readFileSync(`${LOCALES_ROOT}/README.md`, 'utf-8');
      expect(readme).toMatch(/appDataDir|locales\//i);
    });
  });
});
