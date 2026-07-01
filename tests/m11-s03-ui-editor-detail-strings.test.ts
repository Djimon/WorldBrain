// @vitest-environment node
// M11-S03: UI-String-Migration — Editor, Detail-Views & Formulare.
// See: https://github.com/Djimon/WorldBrain/issues/211

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES_ROOT = 'src/locales';

const MIGRATED_FILES: Array<[string, string]> = [
  ['EntityDetailView', 'src/ui/EntityDetailView.tsx'],
  ['CaptureInbox', 'src/ui/CaptureInbox.tsx'],
];

// Files that may not exist until implementation:
const FUTURE_FILES: Array<[string, string]> = [
  ['PropertiesForm', 'src/ui/PropertiesForm.tsx'],
  ['RelationsTab', 'src/ui/RelationsTab.tsx'],
  ['BodyEditor', 'src/ui/BodyEditor.tsx'],
  ['ConditionBuilder', 'src/ui/ConditionBuilder.tsx'],
];

describe('M11-S03 editor / detail-view string migration', () => {
  describe('existing migrated files use t()', () => {
    it.each(MIGRATED_FILES)('%s imports useTranslation', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/useTranslation/);
    });

    it.each(MIGRATED_FILES)('%s calls t() for user-visible strings', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/\bt\(/);
    });

    it.each(MIGRATED_FILES)('%s has no bare placeholder string literals', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).not.toMatch(/placeholder=["'][A-Za-z]/u);
    });
  });

  describe('future files exist once implemented', () => {
    it.each(FUTURE_FILES)('%s file exists', (_name, path) => {
      expect(existsSync(path)).toBe(true);
    });

    it.each(FUTURE_FILES)('%s imports useTranslation', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/useTranslation/);
    });
  });

  describe('entity namespace locale keys', () => {
    it('en/entity.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/entity.json`)).toBe(true);
    });

    it('de/entity.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/entity.json`)).toBe(true);
    });

    it('en/entity.json is non-empty', () => {
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/en/entity.json`, 'utf-8')) as Record<string, unknown>;
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });
  });
});
