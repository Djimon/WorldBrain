// @vitest-environment node
// M17-S04: Theme-Registry + Alternativ-Theme Teal + Entkopplung Dark/Light von Theme
// See: https://github.com/Djimon/WorldBrain/issues/385

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M17-S04 Theme registry', () => {
  async function getThemeRegistry() {
    return import('../src/styles/theme-registry');
  }

  it('theme registry module exists', async () => {
    const mod = await getThemeRegistry();
    expect(mod).toHaveProperty('getTheme');
  });

  it('lists at least default and teal themes', async () => {
    const mod = await getThemeRegistry();
    const themes = mod.listThemes();
    const ids = themes.map((t: { id: string }) => t.id);
    expect(ids).toContain('default');
    expect(ids).toContain('teal');
  });

  it('default theme has modeSupport: per-mode and appearanceSupport: both', async () => {
    const mod = await getThemeRegistry();
    const def = mod.getTheme('default');
    expect(def.modeSupport).toBe('per-mode');
    expect(def.appearanceSupport).toBe('both');
  });

  it('teal theme has modeSupport: per-mode and appearanceSupport: dark', async () => {
    const mod = await getThemeRegistry();
    const teal = mod.getTheme('teal');
    expect(teal.modeSupport).toBe('per-mode');
    expect(teal.appearanceSupport).toBe('dark');
  });

  it('#396: isBuiltinThemeId — true für default/teal, false für unbekannte/User-IDs', async () => {
    const mod = await getThemeRegistry();
    expect(mod.isBuiltinThemeId('default')).toBe(true);
    expect(mod.isBuiltinThemeId('teal')).toBe(true);
    expect(mod.isBuiltinThemeId('some-user-theme')).toBe(false);
  });
});

describe('M17-S04 Dark/Light decoupled from Theme', () => {
  it('theme.ts no longer mixes appearance and theme in one union', () => {
    const source = readFileSync('src/theme.ts', 'utf-8');
    expect(source).not.toMatch(/type Theme\s*=\s*['"]light['"]\s*\|\s*['"]dark['"]\s*\|\s*['"]toxic['"]/);
  });

  it('two separate persistence keys for appearance and theme', () => {
    const source = readFileSync('src/theme.ts', 'utf-8');
    expect(source).toMatch(/appearance|colorScheme/i);
    expect(source).toMatch(/theme/i);
  });
});

describe('M17-S04 Teal theme values', () => {
  it('teal live accent is #19b8a6', async () => {
    const mod = await import('../src/styles/theme-registry');
    const teal = mod.getTheme('teal');
    const liveTokens = teal.tokens?.play ?? teal.tokens?.live;
    expect(liveTokens?.['--mode-accent']).toMatch(/#19b8a6/i);
  });

  it('teal prep accent stays red #e5484d', async () => {
    const mod = await import('../src/styles/theme-registry');
    const teal = mod.getTheme('teal');
    const prepTokens = teal.tokens?.edit ?? teal.tokens?.prep;
    expect(prepTokens?.['--mode-accent']).toMatch(/#e5484d/i);
  });
});

describe('M17-S04 Single-appearance handling', () => {
  it('dark/light toggle disabled for single-appearance theme', () => {
    const source = readFileSync('src/ui/ThemeToggle.tsx', 'utf-8');
    expect(source).toMatch(/appearanceSupport|disabled|single/i);
  });
});

describe('M17-S04 toxic.css replaced', () => {
  it('toxic.css no longer exists', () => {
    let found = false;
    try {
      readFileSync('src/styles/themes/toxic.css', 'utf-8');
      found = true;
    } catch { /* expected */ }
    expect(found).toBe(false);
  });
});
