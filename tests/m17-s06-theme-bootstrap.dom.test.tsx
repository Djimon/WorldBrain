// @vitest-environment jsdom
// M17-S06 (#393): bootstrapUserThemes() registriert importierbare User-Themes für
// JEDES Fenster/Root (auch abgedockte) und wendet danach das gespeicherte Theme an
// — sodass ein aktives User-Theme in Sekundärfenstern nicht still auf Default fällt.
import { afterEach, describe, expect, it, vi } from 'vitest';

const CARBON = JSON.stringify({
  id: 'carbon-boot', label: 'Carbon', appearance: 'dark', modeSupport: 'unified',
  dark: {
    palette: { '--color-background': '#0d0d0f', '--color-surface': '#17171a' },
    accents: { accent: '#8b8b93', hover: '#a0a0a8', on: '#0d0d0f', text: '#c7c7cf', soft: 'rgba(139,139,147,0.16)' },
  },
});
const files: Record<string, string> = { 'carbon.json': CARBON };

// #406: themes now live under Documents\WorldsAndBeyond\themes (documentDir), not appDataDir.
vi.mock('@tauri-apps/api/path', () => ({
  documentDir: vi.fn(() => Promise.resolve('/docs')),
  resourceDir: vi.fn(() => Promise.resolve('/res')),
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(async () => Object.keys(files).map((name) => ({ name, isFile: true, isDirectory: false }))),
  readTextFile: vi.fn(async (path: string) => files[path.split('/').pop() ?? path]),
  exists: vi.fn(() => Promise.resolve(false)),
  mkdir: vi.fn(() => Promise.resolve()),
  copyFile: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  localStorage.clear();
  const el = document.documentElement;
  el.removeAttribute('style');
  for (const a of ['data-theme', 'data-appearance', 'data-mode', 'data-user-theme-vars']) el.removeAttribute(a);
});

describe('M17-#393 bootstrapUserThemes for any window/root', () => {
  it('a secondary root that runs the bootstrap sees the user theme (no default fallback)', async () => {
    const { bootstrapUserThemes } = await import('../src/theme');
    const { getTheme } = await import('../src/styles/theme-registry');
    await bootstrapUserThemes();
    expect(getTheme('carbon-boot').id).toBe('carbon-boot'); // registriert, KEIN default-Fallback
    expect(getTheme('carbon-boot').builtin).toBeFalsy();
  });

  it('re-applies a stored user theme after the scan → inline vars, kein Default', async () => {
    localStorage.setItem('theme', 'carbon-boot');
    localStorage.setItem('appearance', 'dark');
    const { bootstrapUserThemes } = await import('../src/theme');
    await bootstrapUserThemes();
    // applyStoredTheme() lief nach dem Scan → Palette des User-Themes inline gesetzt.
    expect(document.documentElement.style.getPropertyValue('--color-background').trim()).toBe('#0d0d0f');
    expect(document.documentElement.getAttribute('data-theme')).toBe('carbon-boot');
  });
});
