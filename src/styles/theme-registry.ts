// M17-S04 (#385): Theme-Registry — die EINE Quelle der ausgelieferten Themes.
// DREI orthogonale Achsen (Decision 5), die NIE vermischt werden:
//   Shell-Modus   — edit/play
//   Erscheinung   — light/dark (reine Anzeige-Präferenz, KEIN Theme)
//   Theme         — das vollständige benannte Skin (default/teal)
// Jedes Theme deklariert zwei unabhängige Fähigkeits-Achsen:
//   modeSupport       'unified' (eine Farbwelt) | 'per-mode' (Akzent je Shell-Modus)
//   appearanceSupport 'both' (eigener Dark- UND Light-Satz) | 'dark' | 'light' (eine erzwungene Erscheinung)

export type ShellMode = 'edit' | 'play';
export type Appearance = 'light' | 'dark';
export type ModeSupport = 'unified' | 'per-mode';
export type AppearanceSupport = 'both' | 'dark' | 'light';

export interface AccentTokens {
  '--mode-accent': string;
  '--mode-accent-hover': string;
  '--mode-accent-on': string;
  '--mode-accent-text': string;
  '--mode-accent-soft': string;
}

/** Palette-Overrides (VS-Code-Stil): beliebige --color-*-Tokens; nicht gesetzte
 *  erben die Basis-Palette der aktiven Erscheinung. Nur bekannte Namen (s.u.). */
export type PaletteOverrides = Partial<Record<string, string>>;

/** Vollständiger Skin für EINE Erscheinung (dark oder light): Palette-Overrides
 *  + Akzent-Satz je Shell-Modus (per-mode) bzw. geteilt unter 'edit' (unified). */
export interface AppearanceSkin {
  palette?: PaletteOverrides;
  tokens: Partial<Record<ShellMode, AccentTokens>>;
}

export interface ThemeDef {
  id: string;
  labelKey: string;
  defaultLabel: string;
  modeSupport: ModeSupport;
  appearanceSupport: AppearanceSupport;
  /** Kanonischer Akzent-Satz je Shell-Modus (per-mode) bzw. der eine geteilte Satz
   *  unter 'edit' (unified). Bei appearanceSupport 'both' sind dies die Dark-Werte;
   *  bei eingebauten Themes liefert die Light-Variante die CSS-Kaskade in
   *  tokens.css. Dient außerdem als Vorschau-Quelle (previewAccent). */
  tokens: Partial<Record<ShellMode, AccentTokens>>;
  /** #388 — Voll-Token-Skins je Erscheinung, vom JS-Applier zur Laufzeit inline
   *  gesetzt. NUR bei importierten User-Themes gefüllt; eingebaute Themes lassen
   *  dies leer (sie sind CSS-getrieben, der Applier fasst sie nicht an). */
  skins?: Partial<Record<Appearance, AppearanceSkin>>;
  /** true = eingebaut/CSS-getrieben (default/teal): nicht überschreibbar, kein
   *  Inline-Applier. Importierte User-Themes sind es NICHT. */
  builtin?: boolean;
}

/** #388 — die themebaren --color-*-Tokens (Basis-Palette aus tokens.css, plus der
 *  aufgetrennte Schatten-Farbanteil --color-shadow-panel). Ein User-Theme darf nur
 *  diese Namen als palette-Override setzen; die fünf --mode-accent-* laufen über
 *  `accents`. Geometrie (--radius-*, --space-*, Schatten-Pixel) ist NICHT themebar. */
export const THEMEABLE_COLOR_TOKENS: ReadonlySet<string> = new Set([
  '--color-text', '--color-text-muted',
  '--color-accent', '--color-accent-strong', '--color-accent-soft',
  '--color-surface', '--color-surface-alt', '--color-surface-hover', '--color-surface-active',
  '--color-background', '--color-border',
  '--color-status-success', '--color-status-warning', '--color-status-failure', '--color-status-muted',
  '--color-on-accent', '--color-scrim', '--color-overlay-border',
  '--color-shadow', '--color-highlight',
  '--color-layer-image', '--color-layer-fog', '--color-layer-token',
  '--color-swatch-outline', '--color-print-border',
  '--color-focus-glow', '--color-error-soft', '--color-shadow-panel',
]);

/** Die fünf Akzent-Token-Namen in kanonischer Reihenfolge (Mapping-Ziel für
 *  einen `accents`-Satz im User-Theme-Format). */
export const ACCENT_TOKEN_KEYS: readonly (keyof AccentTokens)[] = [
  '--mode-accent', '--mode-accent-hover', '--mode-accent-on', '--mode-accent-text', '--mode-accent-soft',
];

const DEFAULT_THEME: ThemeDef = {
  id: 'default',
  labelKey: 'theme.default',
  defaultLabel: 'Standard',
  modeSupport: 'per-mode',
  appearanceSupport: 'both',
  builtin: true,
  tokens: {
    edit: {
      '--mode-accent': '#e5484d', '--mode-accent-hover': '#ef5a5f', '--mode-accent-on': '#ffffff',
      '--mode-accent-text': '#f0888b', '--mode-accent-soft': 'rgba(229,72,77,0.16)',
    },
    play: {
      '--mode-accent': '#eaa53c', '--mode-accent-hover': '#f2b451', '--mode-accent-on': '#241a05',
      '--mode-accent-text': '#f2bd63', '--mode-accent-soft': 'rgba(234,165,60,0.16)',
    },
  },
};

const TEAL_THEME: ThemeDef = {
  id: 'teal',
  labelKey: 'theme.teal',
  defaultLabel: 'Teal',
  modeSupport: 'per-mode',
  appearanceSupport: 'dark', // Single-Appearance: erzwingt Dark, Dark/Light-Umschalter aus
  builtin: true,
  tokens: {
    edit: {
      // Prep bleibt Rot (stabil über beide ausgelieferten Themes).
      '--mode-accent': '#e5484d', '--mode-accent-hover': '#ef5a5f', '--mode-accent-on': '#ffffff',
      '--mode-accent-text': '#f0888b', '--mode-accent-soft': 'rgba(229,72,77,0.16)',
    },
    play: {
      // Live = Teal.
      '--mode-accent': '#19b8a6', '--mode-accent-hover': '#2ad0bd', '--mode-accent-on': '#04342c',
      '--mode-accent-text': '#4fd8c8', '--mode-accent-soft': 'rgba(25,184,166,0.16)',
    },
  },
};

const THEMES: Record<string, ThemeDef> = {
  [DEFAULT_THEME.id]: DEFAULT_THEME,
  [TEAL_THEME.id]: TEAL_THEME,
};

export function listThemes(): ThemeDef[] {
  return Object.values(THEMES);
}

export function getTheme(id: string): ThemeDef {
  return THEMES[id] ?? DEFAULT_THEME;
}

/** #396 — ist `id` eine EINGEBAUTE Theme-ID? (Ohne Fallback — anders als getTheme,
 *  das für unbekannte/noch-nicht-registrierte IDs `default` liefert.) Genutzt im
 *  Startup, um zu entscheiden, ob vor dem ersten Paint auf den User-Theme-Scan
 *  gewartet werden muss (Flash-Vermeidung). */
export function isBuiltinThemeId(id: string): boolean {
  return THEMES[id]?.builtin === true;
}

/**
 * #388 — ein (importiertes) User-Theme registrieren. Eingebaute IDs
 * (`default`/`teal`) sind NICHT überschreibbar: Kollision → Built-in gewinnt,
 * `false` zurück (Aufrufer loggt + überspringt die Datei). Sonst wird das Theme
 * in die interne Map aufgenommen und ab sofort von `listThemes()`/`getTheme()`
 * geführt; `true` zurück.
 */
export function registerTheme(def: ThemeDef): boolean {
  if (THEMES[def.id]?.builtin) return false;
  THEMES[def.id] = def;
  return true;
}

/**
 * Erzwungene Erscheinung eines Single-Appearance-Themes (`dark`/`light`) — oder
 * `null`, wenn das Theme `both` unterstützt (Erscheinung frei wählbar). Der
 * Dark/Light-Umschalter wird deaktiviert, wenn dies nicht `null` ist.
 */
export function forcedAppearance(theme: ThemeDef): Appearance | null {
  return theme.appearanceSupport === 'both' ? null : theme.appearanceSupport;
}

/** Repräsentativer Akzent eines Themes für die Vorschau (Live-Modus, sonst der
 *  geteilte Satz) — vom ThemePicker als Farb-Swatch genutzt. */
export function previewAccent(theme: ThemeDef): string {
  return (theme.tokens.play ?? theme.tokens.edit)?.['--mode-accent'] ?? 'transparent';
}
