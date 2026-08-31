// @vitest-environment jsdom
// M17-S06 (#388): JS-Applier für User-Themes + ThemePicker-Mount.
// User-Theme aktiv → alle Override-Vars inline auf documentElement (Palette +
// Modus-Accent); Built-in aktiv → keine Inline-Vars (CSS zuständig). Moduswechsel
// schaltet den Accent, Erscheinungswechsel (both) schaltet den Satz.
import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyThemeVars } from '../src/theme';
import { registerTheme, getTheme } from '../src/styles/theme-registry';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: { language: 'de' } }),
}));

const USER_ID = 'amethyst-test';

beforeAll(() => {
  registerTheme({
    id: USER_ID, labelKey: `theme.${USER_ID}`, defaultLabel: 'Amethyst-Test',
    modeSupport: 'per-mode', appearanceSupport: 'both',
    tokens: {
      edit: { '--mode-accent': '#e5484d', '--mode-accent-hover': '#ef5a5f', '--mode-accent-on': '#ffffff', '--mode-accent-text': '#f0888b', '--mode-accent-soft': 'rgba(229,72,77,0.16)' },
      play: { '--mode-accent': '#a855f7', '--mode-accent-hover': '#b975f9', '--mode-accent-on': '#1a0733', '--mode-accent-text': '#d8b4fe', '--mode-accent-soft': 'rgba(168,85,247,0.16)' },
    },
    skins: {
      dark: {
        palette: { '--color-background': '#160a26', '--color-surface': '#241236' },
        tokens: {
          edit: { '--mode-accent': '#e5484d', '--mode-accent-hover': '#ef5a5f', '--mode-accent-on': '#ffffff', '--mode-accent-text': '#f0888b', '--mode-accent-soft': 'rgba(229,72,77,0.16)' },
          play: { '--mode-accent': '#a855f7', '--mode-accent-hover': '#b975f9', '--mode-accent-on': '#1a0733', '--mode-accent-text': '#d8b4fe', '--mode-accent-soft': 'rgba(168,85,247,0.16)' },
        },
      },
      light: {
        palette: { '--color-background': '#f6f2fb', '--color-surface': '#ffffff' },
        tokens: {
          edit: { '--mode-accent': '#c1121f', '--mode-accent-hover': '#a80f1a', '--mode-accent-on': '#ffffff', '--mode-accent-text': '#b3121f', '--mode-accent-soft': 'rgba(193,18,31,0.12)' },
          play: { '--mode-accent': '#7c3aed', '--mode-accent-hover': '#6d28d9', '--mode-accent-on': '#ffffff', '--mode-accent-text': '#7c3aed', '--mode-accent-soft': 'rgba(124,58,237,0.14)' },
        },
      },
    },
  });
});

afterEach(() => {
  cleanup();
  const el = document.documentElement;
  for (const a of ['data-theme', 'data-appearance', 'data-mode', 'data-user-theme-vars']) el.removeAttribute(a);
  el.removeAttribute('style');
});

const val = (name: string) => document.documentElement.style.getPropertyValue(name).trim();

describe('M17-S06 applier: User-Theme setzt Voll-Token inline', () => {
  it('aktives User-Theme (dark/edit) → Palette + edit-Accent inline', () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', USER_ID);
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-mode', 'edit');
    applyThemeVars();
    expect(val('--color-background')).toBe('#160a26');
    expect(val('--color-surface')).toBe('#241236');
    expect(val('--mode-accent')).toBe('#e5484d');
  });

  it('Moduswechsel edit→play schaltet den Accent (per-mode)', () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', USER_ID);
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-mode', 'edit');
    applyThemeVars();
    expect(val('--mode-accent')).toBe('#e5484d');
    el.setAttribute('data-mode', 'play');
    applyThemeVars();
    expect(val('--mode-accent')).toBe('#a855f7');
  });

  it('Erscheinungswechsel dark→light schaltet Palette + Accent (both)', () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', USER_ID);
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-mode', 'play');
    applyThemeVars();
    expect(val('--color-background')).toBe('#160a26');
    expect(val('--mode-accent')).toBe('#a855f7');
    el.setAttribute('data-appearance', 'light');
    applyThemeVars();
    expect(val('--color-background')).toBe('#f6f2fb');
    expect(val('--mode-accent')).toBe('#7c3aed');
  });

  it('Wechsel auf Built-in (default) räumt alle Inline-Vars ab', () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', USER_ID);
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-mode', 'edit');
    applyThemeVars();
    expect(val('--color-background')).toBe('#160a26');
    el.setAttribute('data-theme', 'default');
    applyThemeVars();
    expect(val('--color-background')).toBe('');
    expect(val('--mode-accent')).toBe('');
    expect(el.hasAttribute('data-user-theme-vars')).toBe(false);
  });

  it('Built-in default setzt gar keine Inline-Vars', () => {
    const el = document.documentElement;
    el.setAttribute('data-theme', 'default');
    el.setAttribute('data-appearance', 'dark');
    el.setAttribute('data-mode', 'edit');
    expect(getTheme('default').builtin).toBe(true);
    applyThemeVars();
    expect(val('--color-background')).toBe('');
    expect(val('--mode-accent')).toBe('');
  });
});

describe('M17-S06 mount: User-Theme erscheint im ThemePicker', () => {
  it('registriertes User-Theme ist eine Option im ThemePicker', async () => {
    const { ThemePicker } = await import('../src/ui/ThemePicker');
    render(React.createElement(ThemePicker));
    expect(screen.getByText('Amethyst-Test')).toBeTruthy();
  });
});
