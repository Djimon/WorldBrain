// M17-S04 (#385): Theme registry — the ONE source of the shipped themes.
// THREE orthogonal axes (Decision 5) that are NEVER mixed:
//   Shell mode    — edit/play
//   Appearance    — light/dark (pure display preference, NOT a theme)
//   Theme         — the complete named skin (default/teal)
// Each theme declares two independent capability axes:
//   modeSupport       'unified' (one color world) | 'per-mode' (accent per shell mode)
//   appearanceSupport 'both' (its own dark AND light set) | 'dark' | 'light' (a single forced appearance)

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

/** Palette overrides (VS Code style): any --color-* tokens; those not set
 *  inherit the base palette of the active appearance. Only known names (see below). */
export type PaletteOverrides = Partial<Record<string, string>>;

/** Complete skin for ONE appearance (dark or light): palette overrides
 *  + accent set per shell mode (per-mode) or shared under 'edit' (unified). */
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
  /** Canonical accent set per shell mode (per-mode) or the one shared set
   *  under 'edit' (unified). With appearanceSupport 'both' these are the dark values;
   *  for built-in themes the light variant is provided by the CSS cascade in
   *  tokens.css. Also serves as the preview source (previewAccent). */
  tokens: Partial<Record<ShellMode, AccentTokens>>;
  /** #388 — full-token skins per appearance, set inline at runtime by the JS applier.
   *  Filled ONLY for imported user themes; built-in themes leave
   *  this empty (they are CSS-driven, the applier does not touch them). */
  skins?: Partial<Record<Appearance, AppearanceSkin>>;
  /** true = built-in/CSS-driven (default/teal): not overridable, no
   *  inline applier. Imported user themes are NOT. */
  builtin?: boolean;
}

/** #388 — the themeable --color-* tokens (base palette from tokens.css, plus the
 *  split-out shadow color component --color-shadow-panel). A user theme may set only
 *  these names as palette overrides; the five --mode-accent-* go through
 *  `accents`. Geometry (--radius-*, --space-*, shadow pixels) is NOT themeable. */
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

/** The five accent token names in canonical order (mapping target for
 *  an `accents` set in the user-theme format). */
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
  appearanceSupport: 'dark', // Single appearance: forces dark, dark/light toggle off
  builtin: true,
  tokens: {
    edit: {
      // Prep stays red (stable across both shipped themes).
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

/** #396 — is `id` a BUILT-IN theme id? (No fallback — unlike getTheme,
 *  which returns `default` for unknown/not-yet-registered ids.) Used at
 *  startup to decide whether the user-theme scan must be awaited before the
 *  first paint (flash avoidance). */
export function isBuiltinThemeId(id: string): boolean {
  return THEMES[id]?.builtin === true;
}

/**
 * #388 — register an (imported) user theme. Built-in ids
 * (`default`/`teal`) are NOT overridable: collision → built-in wins,
 * returns `false` (the caller logs + skips the file). Otherwise the theme
 * is added to the internal map and from then on carried by `listThemes()`/`getTheme()`;
 * returns `true`.
 */
export function registerTheme(def: ThemeDef): boolean {
  if (THEMES[def.id]?.builtin) return false;
  THEMES[def.id] = def;
  return true;
}

/**
 * Forced appearance of a single-appearance theme (`dark`/`light`) — or
 * `null` when the theme supports `both` (appearance freely selectable). The
 * dark/light toggle is disabled when this is not `null`.
 */
export function forcedAppearance(theme: ThemeDef): Appearance | null {
  return theme.appearanceSupport === 'both' ? null : theme.appearanceSupport;
}

/** Representative accent of a theme for the preview (live mode, otherwise the
 *  shared set) — used by the ThemePicker as a color swatch. */
export function previewAccent(theme: ThemeDef): string {
  return (theme.tokens.play ?? theme.tokens.edit)?.['--mode-accent'] ?? 'transparent';
}
