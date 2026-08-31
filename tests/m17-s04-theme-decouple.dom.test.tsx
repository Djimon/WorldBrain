// @vitest-environment jsdom
// M17-S04 (#385): Integrationstests — prüfen ECHTES App-Verhalten (die Funktionen,
// die ThemeToggle/ThemePicker tatsächlich nutzen), nicht Test-Attrappen:
// Entkopplung Dark/Light ↔ Theme, Single-Appearance-Erzwingung, Vorschau-Akzent.
import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, forcedAppearance, previewAccent } from '../src/styles/theme-registry';
import {
  setAppearance,
  setThemeId,
  getStoredThemeId,
  getStoredAppearance,
} from '../src/theme';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-appearance');
});

describe('#385 dark/light decoupled from theme', () => {
  it('setAppearance changes only the appearance, NOT the active theme', () => {
    setThemeId('default');
    setAppearance('light');
    expect(getStoredThemeId()).toBe('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light');
    setAppearance('dark');
    expect(getStoredThemeId()).toBe('default'); // Theme unverändert
  });

  it('setThemeId does NOT overwrite the stored appearance preference', () => {
    setAppearance('light');
    setThemeId('default');
    expect(getStoredAppearance()).toBe('light');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light');
  });
});

describe('#385 single-appearance theme forces its appearance', () => {
  it('teal forces dark even when the user prefers light; the preference survives', () => {
    setAppearance('light'); // Nutzer-Präferenz: hell
    setThemeId('teal');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark'); // erzwungen
    expect(getStoredAppearance()).toBe('light'); // Präferenz bleibt (Entkopplung)
  });

  it('forcedAppearance drives the ThemeToggle disable state', () => {
    expect(forcedAppearance(getTheme('teal'))).toBe('dark');   // Umschalter deaktiviert
    expect(forcedAppearance(getTheme('default'))).toBeNull();  // frei wählbar
  });
});

describe('#385 theme preview accent (used by the ThemePicker swatch)', () => {
  it('teal previews teal #19b8a6, default previews amber #eaa53c', () => {
    expect(previewAccent(getTheme('teal'))).toBe('#19b8a6');
    expect(previewAccent(getTheme('default'))).toBe('#eaa53c');
  });
});
