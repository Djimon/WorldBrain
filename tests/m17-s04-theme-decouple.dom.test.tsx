// @vitest-environment jsdom
// M17-S04 (#385): Integrationstests — Teal-Akzent-Auflösung, Entkopplung
// Dark/Light ↔ Theme, Single-Appearance-Erzwingung, unified-Zusammenfassung.
import { describe, it, expect, beforeEach } from 'vitest';
import { getTheme, resolveAccent, forcedAppearance, type ThemeDef } from '../src/styles/theme-registry';
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

describe('#385 accent resolution (theme × mode)', () => {
  it('teal: live = teal #19b8a6, prep stays red #e5484d', () => {
    const teal = getTheme('teal');
    expect(resolveAccent(teal, 'play')['--mode-accent']).toBe('#19b8a6');
    expect(resolveAccent(teal, 'edit')['--mode-accent']).toBe('#e5484d');
  });

  it('default: live = amber #eaa53c (Teal-Wechsel ändert Amber→Teal)', () => {
    const def = getTheme('default');
    expect(resolveAccent(def, 'play')['--mode-accent']).toBe('#eaa53c');
    // Prep bleibt Rot in beiden Themes.
    expect(resolveAccent(def, 'edit')['--mode-accent']).toBe('#e5484d');
    expect(resolveAccent(getTheme('teal'), 'edit')['--mode-accent']).toBe('#e5484d');
  });
});

describe('#385 dark/light decoupled from theme', () => {
  it('setAppearance does NOT change the active theme', () => {
    setThemeId('default');
    setAppearance('light');
    expect(getStoredThemeId()).toBe('default');
    expect(document.documentElement.getAttribute('data-theme')).toBe('default');
    setAppearance('dark');
    expect(getStoredThemeId()).toBe('default');
  });

  it('setThemeId does NOT overwrite the stored appearance preference', () => {
    setAppearance('light');
    setThemeId('default');
    expect(getStoredAppearance()).toBe('light');
    expect(document.documentElement.getAttribute('data-appearance')).toBe('light');
  });
});

describe('#385 single-appearance theme forces its appearance', () => {
  it('teal forces dark even when the user prefers light; toggle is disabled', () => {
    setAppearance('light'); // Nutzer-Präferenz: hell
    setThemeId('teal');
    // erzwungene Erscheinung dark trotz Präferenz light …
    expect(document.documentElement.getAttribute('data-appearance')).toBe('dark');
    // … aber die Präferenz bleibt erhalten (Entkopplung).
    expect(getStoredAppearance()).toBe('light');
    // Der Dark/Light-Umschalter wird deaktiviert (forcedAppearance !== null).
    expect(forcedAppearance(getTheme('teal'))).toBe('dark');
    expect(forcedAppearance(getTheme('default'))).toBeNull();
  });
});

describe('#385 unified theme shares the accent across shell modes', () => {
  it('unified: edit and play resolve to the SAME accent', () => {
    const unified: ThemeDef = {
      id: 'test-unified',
      labelKey: 'theme.test',
      defaultLabel: 'Test',
      modeSupport: 'unified',
      appearanceSupport: 'dark',
      tokens: {
        edit: {
          '--mode-accent': '#123456', '--mode-accent-hover': '#223456', '--mode-accent-on': '#ffffff',
          '--mode-accent-text': '#334456', '--mode-accent-soft': 'rgba(18,52,86,0.16)',
        },
      },
    };
    expect(resolveAccent(unified, 'play')).toEqual(resolveAccent(unified, 'edit'));
    expect(resolveAccent(unified, 'play')['--mode-accent']).toBe('#123456');
  });
});
