// @vitest-environment node
// M11-S04: UI-String-Migration — Maps, Session & Play-Mode.
// See: https://github.com/Djimon/WorldBrain/issues/212

import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const LOCALES_ROOT = 'src/locales';

// Files that already exist in the repo:
const EXISTING_FILES: Array<[string, string]> = [
  ['MapViewer', 'src/ui/MapViewer.tsx'],
  ['MapMarkers', 'src/ui/MapMarkers.tsx'],
  ['PlayerScreen', 'src/ui/PlayerScreen.tsx'],
  ['ChronicleView', 'src/ui/ChronicleView.tsx'],
  ['SessionClock', 'src/ui/SessionClock.tsx'],
  ['PrintSheetComposer', 'src/ui/PrintSheetComposer.tsx'],
];

// Files that may be created during implementation:
const FUTURE_FILES: Array<[string, string]> = [
  ['DmScreen', 'src/ui/DmScreen.tsx'],
  ['MapGrid', 'src/ui/MapGrid.tsx'],
  ['EncounterCounters', 'src/ui/EncounterCounters.tsx'],
  ['CalendarWizard', 'src/ui/CalendarWizard.tsx'],
  ['SnapshotManager', 'src/ui/SnapshotManager.tsx'],
  ['ZipImportDialog', 'src/ui/ZipImportDialog.tsx'],
];

describe('M11-S04 map / session / play-mode string migration', () => {
  describe('existing files use t()', () => {
    it.each(EXISTING_FILES)('%s imports useTranslation', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/useTranslation/);
    });

    it.each(EXISTING_FILES)('%s calls t() for user-visible strings', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/\bt\(/);
    });
  });

  describe('future files exist and use t()', () => {
    it.each(FUTURE_FILES)('%s file exists', (_name, path) => {
      expect(existsSync(path)).toBe(true);
    });

    it.each(FUTURE_FILES)('%s imports useTranslation', (_name, path) => {
      const src = readFileSync(path, 'utf-8');
      expect(src).toMatch(/useTranslation/);
    });
  });

  describe('PrintSheetComposer HTML export safety (AC: CSP + HTML escape)', () => {
    it('PrintSheetComposer source contains HTML escape logic', () => {
      const src = readFileSync('src/ui/PrintSheetComposer.tsx', 'utf-8');
      // Must sanitize user content before interpolation into HTML string
      expect(src).toMatch(/escape|sanitize|DOMPurify|innerHTML.*=|replace.*[<>'"]/u);
    });

    it('PrintSheetComposer emits a CSP meta tag in HTML output', () => {
      const src = readFileSync('src/ui/PrintSheetComposer.tsx', 'utf-8');
      expect(src).toMatch(/Content-Security-Policy|csp/i);
    });
  });

  describe('map + session namespace locale keys', () => {
    it('en/map.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/map.json`)).toBe(true);
    });

    it('de/map.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/map.json`)).toBe(true);
    });

    it('en/session.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/en/session.json`)).toBe(true);
    });

    it('de/session.json exists', () => {
      expect(existsSync(`${LOCALES_ROOT}/de/session.json`)).toBe(true);
    });
  });
});
