// @vitest-environment node
// M17-S06 (#388): Importierbare User-Themes — Loader/Validierung + Registry.
// Parse/Map (A/B/C), invalide Dateien, Registry-Registrierung + Built-in-Schutz,
// Ordner-Scan (fs gemockt). Reine Funktionen + Registry-Singleton.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseUserTheme, validateUserTheme } from '../src/services/user-theme-loader';
import { getTheme, listThemes, registerTheme } from '../src/styles/theme-registry';

// ── Fixtures (die drei dokumentierten Kombinationen) ─────────────────────────
const A_DARK_UNIFIED = JSON.stringify({
  id: 'carbon', label: 'Carbon', appearance: 'dark', modeSupport: 'unified',
  dark: {
    palette: { '--color-background': '#0d0d0f', '--color-surface': '#17171a', '--color-text': '#e6e6ea' },
    accents: { accent: '#8b8b93', hover: '#a0a0a8', on: '#0d0d0f', text: '#c7c7cf', soft: 'rgba(139,139,147,0.16)' },
  },
});
const B_BOTH_UNIFIED = JSON.stringify({
  id: 'sepia', label: 'Sepia', appearance: 'both', modeSupport: 'unified',
  dark: {
    palette: { '--color-background': '#1c1712' },
    accents: { accent: '#b5895c', hover: '#c99e72', on: '#1c1712', text: '#d8b48a', soft: 'rgba(181,137,92,0.16)' },
  },
  light: {
    palette: { '--color-background': '#f5efe6' },
    accents: { accent: '#8a5a2b', hover: '#734a22', on: '#ffffff', text: '#8a5a2b', soft: 'rgba(138,90,43,0.14)' },
  },
});
const C_BOTH_PERMODE = JSON.stringify({
  id: 'amethyst', label: 'Amethyst', appearance: 'both', modeSupport: 'per-mode',
  dark: {
    palette: { '--color-accent': '#a855f7' },
    accents: {
      edit: { accent: '#e5484d', hover: '#ef5a5f', on: '#ffffff', text: '#f0888b', soft: 'rgba(229,72,77,0.16)' },
      play: { accent: '#a855f7', hover: '#b975f9', on: '#1a0733', text: '#d8b4fe', soft: 'rgba(168,85,247,0.16)' },
    },
  },
  light: {
    accents: {
      edit: { accent: '#c1121f', hover: '#a80f1a', on: '#ffffff', text: '#b3121f', soft: 'rgba(193,18,31,0.12)' },
      play: { accent: '#7c3aed', hover: '#6d28d9', on: '#ffffff', text: '#7c3aed', soft: 'rgba(124,58,237,0.14)' },
    },
  },
});

describe('M17-S06 parse/map happy path', () => {
  it('A — dark + unified: eine Farbwelt, nur dark', () => {
    const res = parseUserTheme(A_DARK_UNIFIED);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const d = res.def;
    expect(d.id).toBe('carbon');
    expect(d.appearanceSupport).toBe('dark');
    expect(d.modeSupport).toBe('unified');
    expect(d.skins?.dark?.palette?.['--color-background']).toBe('#0d0d0f');
    // unified: geteilter Satz unter 'edit'
    expect(d.skins?.dark?.tokens.edit?.['--mode-accent']).toBe('#8b8b93');
    expect(d.skins?.dark?.tokens.play).toBeUndefined();
    expect(d.skins?.light).toBeUndefined();
    // Top-Level tokens (Vorschau) = primärer (dark) Skin
    expect(d.tokens.edit?.['--mode-accent']).toBe('#8b8b93');
    expect(d.builtin).toBeFalsy();
  });

  it('B — both + unified: eigener Dark- UND Light-Satz, je eine Farbe', () => {
    const res = validateUserTheme(JSON.parse(B_BOTH_UNIFIED));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const d = res.def;
    expect(d.appearanceSupport).toBe('both');
    expect(d.modeSupport).toBe('unified');
    expect(d.skins?.dark?.tokens.edit?.['--mode-accent']).toBe('#b5895c');
    expect(d.skins?.light?.tokens.edit?.['--mode-accent']).toBe('#8a5a2b');
    expect(d.skins?.light?.palette?.['--color-background']).toBe('#f5efe6');
  });

  it('C — both + per-mode: getrennte edit/play je Erscheinung', () => {
    const res = parseUserTheme(C_BOTH_PERMODE);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const d = res.def;
    expect(d.appearanceSupport).toBe('both');
    expect(d.modeSupport).toBe('per-mode');
    expect(d.skins?.dark?.tokens.edit?.['--mode-accent']).toBe('#e5484d');
    expect(d.skins?.dark?.tokens.play?.['--mode-accent']).toBe('#a855f7');
    expect(d.skins?.light?.tokens.play?.['--mode-accent']).toBe('#7c3aed');
    expect(d.skins?.dark?.palette?.['--color-accent']).toBe('#a855f7');
  });
});

describe('M17-S06 invalide Dateien werden verworfen', () => {
  it('fehlendes Accent-Feld (soft) → verworfen', () => {
    const bad = JSON.stringify({
      id: 'x', label: 'X', appearance: 'dark', modeSupport: 'unified',
      dark: { accents: { accent: '#111', hover: '#222', on: '#333', text: '#444' } },
    });
    expect(parseUserTheme(bad).ok).toBe(false);
  });

  it('ungültige appearance → verworfen', () => {
    const bad = JSON.stringify({ id: 'x', label: 'X', appearance: 'sepia', modeSupport: 'unified', dark: {} });
    expect(parseUserTheme(bad).ok).toBe(false);
  });

  it('unbekannter --color-*-Token → verworfen', () => {
    const bad = JSON.stringify({
      id: 'x', label: 'X', appearance: 'dark', modeSupport: 'unified',
      dark: { palette: { '--color-bogus': '#000' }, accents: { accent: '#111', hover: '#222', on: '#333', text: '#444', soft: '#555' } },
    });
    expect(parseUserTheme(bad).ok).toBe(false);
  });

  it('ungültige id (Großbuchstaben) → verworfen', () => {
    const bad = JSON.stringify({ id: 'Bad_Id', label: 'X', appearance: 'dark', modeSupport: 'unified', dark: { accents: {} } });
    expect(parseUserTheme(bad).ok).toBe(false);
  });

  it('both, aber Light-Block fehlt → verworfen', () => {
    const bad = JSON.stringify({
      id: 'x', label: 'X', appearance: 'both', modeSupport: 'unified',
      dark: { accents: { accent: '#111', hover: '#222', on: '#333', text: '#444', soft: '#555' } },
    });
    expect(parseUserTheme(bad).ok).toBe(false);
  });

  it('kaputtes JSON → verworfen (kein Wurf)', () => {
    expect(parseUserTheme('{ not json ').ok).toBe(false);
  });
});

describe('M17-S06 Registry: registrieren + Built-in-Schutz', () => {
  it('nach registerTheme ist es in listThemes/getTheme', () => {
    const res = parseUserTheme(A_DARK_UNIFIED.replace('"carbon"', '"carbon-reg"'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(registerTheme(res.def)).toBe(true);
    expect(listThemes().map((t) => t.id)).toContain('carbon-reg');
    expect(getTheme('carbon-reg').defaultLabel).toBe('Carbon');
  });

  it('Kollision mit eingebauter id überschreibt NICHT', () => {
    const res = parseUserTheme(A_DARK_UNIFIED.replace('"carbon"', '"default"'));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(registerTheme(res.def)).toBe(false);
    // default bleibt das eingebaute Theme
    expect(getTheme('default').builtin).toBe(true);
    expect(getTheme('default').modeSupport).toBe('per-mode');
  });
});

// ── Ordner-Scan (fs gemockt) ─────────────────────────────────────────────────
const files: Record<string, string> = {};
vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(async () => Object.keys(files).map((name) => ({ name, isFile: true, isDirectory: false }))),
  readTextFile: vi.fn(async (path: string) => {
    const name = path.split('/').pop() ?? path;
    if (!(name in files)) throw new Error('ENOENT');
    return files[name];
  }),
}));
vi.mock('@tauri-apps/api/path', () => ({ join: vi.fn(async (...parts: string[]) => parts.join('/')) }));

describe('M17-S06 scanUserThemes: valide laden, invalide überspringen', () => {
  beforeEach(() => { for (const k of Object.keys(files)) delete files[k]; });
  afterEach(() => { vi.clearAllMocks(); });

  it('invalide Datei überspringen, danebenliegende valide lädt trotzdem', async () => {
    files['good.json'] = A_DARK_UNIFIED.replace('"carbon"', '"carbon-scan"');
    files['broken.json'] = '{ not json';
    files['collide.json'] = A_DARK_UNIFIED.replace('"carbon"', '"teal"'); // Built-in
    const { scanUserThemes } = await import('../src/services/user-theme-loader');
    const result = await scanUserThemes('/app/themes');
    expect(result.registered).toContain('carbon-scan');
    expect(result.skipped.map((s) => s.file).sort()).toEqual(['broken.json', 'collide.json']);
    expect(getTheme('carbon-scan').appearanceSupport).toBe('dark');
    // Built-in teal blieb unangetastet
    expect(getTheme('teal').builtin).toBe(true);
  });

  it('fehlender Ordner → leeres Ergebnis, kein Fehler', async () => {
    const fs = await import('@tauri-apps/plugin-fs');
    (fs.readDir as unknown as { mockRejectedValueOnce: (e: unknown) => void }).mockRejectedValueOnce(new Error('ENOENT'));
    const { scanUserThemes } = await import('../src/services/user-theme-loader');
    const result = await scanUserThemes('/nope/themes');
    expect(result.registered).toEqual([]);
    expect(result.skipped).toEqual([]);
  });
});
