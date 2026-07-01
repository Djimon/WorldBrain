// @vitest-environment node
// M11-S02: UI-String-Migration — Navigation, Shell & Onboarding.
// Verifies that WelcomeScreen, WorkspaceShell, NewProjectDialog use t() and
// have no hardcoded user-visible strings.
// See: https://github.com/Djimon/WorldBrain/issues/210

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES_ROOT = 'src/locales';

function readSrc(path: string) {
  return readFileSync(path, 'utf-8');
}

describe('M11-S02 UI nav/shell/onboarding string migration', () => {
  describe('WelcomeScreen.tsx', () => {
    it('imports useTranslation from react-i18next', () => {
      const src = readSrc('src/ui/WelcomeScreen.tsx');
      expect(src).toMatch(/useTranslation/);
    });

    it('calls t() for user-visible strings', () => {
      const src = readSrc('src/ui/WelcomeScreen.tsx');
      expect(src).toMatch(/\bt\(/);
    });

    it('contains no hardcoded "Neues Projekt" string', () => {
      const src = readSrc('src/ui/WelcomeScreen.tsx');
      expect(src).not.toContain('Neues Projekt');
    });

    it('contains no hardcoded "New Project" string', () => {
      const src = readSrc('src/ui/WelcomeScreen.tsx');
      expect(src).not.toContain('New Project');
    });
  });

  describe('WorkspaceShell.tsx', () => {
    it('imports useTranslation from react-i18next', () => {
      const src = readSrc('src/ui/WorkspaceShell.tsx');
      expect(src).toMatch(/useTranslation/);
    });

    it('calls t() for user-visible strings', () => {
      const src = readSrc('src/ui/WorkspaceShell.tsx');
      expect(src).toMatch(/\bt\(/);
    });

    it('contains no hardcoded "Karten" label', () => {
      const src = readSrc('src/ui/WorkspaceShell.tsx');
      expect(src).not.toMatch(/>Karten</u);
    });

    it('contains no hardcoded "Chronik" label', () => {
      const src = readSrc('src/ui/WorkspaceShell.tsx');
      expect(src).not.toMatch(/>Chronik</u);
    });
  });

  describe('NewProjectDialog.tsx', () => {
    it('imports useTranslation from react-i18next', () => {
      const src = readSrc('src/ui/NewProjectDialog.tsx');
      expect(src).toMatch(/useTranslation/);
    });

    it('calls t() for user-visible strings', () => {
      const src = readSrc('src/ui/NewProjectDialog.tsx');
      expect(src).toMatch(/\bt\(/);
    });

    it('placeholder attributes use t()', () => {
      const src = readSrc('src/ui/NewProjectDialog.tsx');
      // placeholder must not be a bare string literal
      expect(src).not.toMatch(/placeholder=["'][A-Za-z]/u);
    });
  });

  describe('nav namespace locale keys', () => {
    it('en/nav.json exists and is non-empty', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/nav.json`)).toBe(true);
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/en/nav.json`, 'utf-8')) as Record<string, unknown>;
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('de/nav.json exists and is non-empty', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/nav.json`)).toBe(true);
      const data = JSON.parse(readFileSync(`${LOCALES_ROOT}/de/nav.json`, 'utf-8')) as Record<string, unknown>;
      expect(Object.keys(data).length).toBeGreaterThan(0);
    });

    it('en/common.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/common.json`)).toBe(true);
    });

    it('de/common.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/common.json`)).toBe(true);
    });
  });
});
