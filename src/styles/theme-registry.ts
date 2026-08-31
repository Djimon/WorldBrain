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

export interface ThemeDef {
  id: string;
  labelKey: string;
  defaultLabel: string;
  modeSupport: ModeSupport;
  appearanceSupport: AppearanceSupport;
  /** Kanonischer Akzent-Satz je Shell-Modus (per-mode) bzw. der eine geteilte Satz
   *  unter 'edit' (unified). Bei appearanceSupport 'both' sind dies die Dark-Werte;
   *  die Light-Variante liefert die CSS-Kaskade in tokens.css (Runtime-Wahrheit). */
  tokens: Partial<Record<ShellMode, AccentTokens>>;
}

const DEFAULT_THEME: ThemeDef = {
  id: 'default',
  labelKey: 'theme.default',
  defaultLabel: 'Standard',
  modeSupport: 'per-mode',
  appearanceSupport: 'both',
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
