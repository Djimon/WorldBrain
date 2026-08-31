// Shared theme handling for every window (main + detached soundboard/player
// WebviewWindows). Each window applies the persisted state to its OWN <html>.
//
// M17-S04 (#385): Entkopplung — Erscheinung (dark/light) und Theme (default/teal)
// sind ZWEI orthogonale Achsen mit getrennten Persistenz-Keys und getrennten
// DOM-Attributen (Decision 5). Ein Dark/Light-Wechsel ändert NIE das Theme und
// umgekehrt. Ein Single-Appearance-Theme (z.B. Teal = dark) erzwingt seine
// Erscheinung; der Dark/Light-Umschalter ist dann wirkungslos.
import { getTheme, forcedAppearance, type Appearance } from './styles/theme-registry';

const APPEARANCE_KEY = 'appearance';
const THEME_KEY = 'theme';

/** In-window Signal, dass sich Theme/Erscheinung geändert hat (storage feuert nur
 *  in ANDEREN Fenstern; Geschwister-Controls im selben Fenster hören hierauf). */
export const THEME_CHANGE_EVENT = 'wbx:themechange';

export function getStoredAppearance(): Appearance {
  const a = localStorage.getItem(APPEARANCE_KEY);
  return a === 'light' || a === 'dark' ? a : 'dark';
}

export function getStoredThemeId(): string {
  return localStorage.getItem(THEME_KEY) ?? 'default';
}

/** Erscheinung als `data-appearance` (light = bare :root-Palette, dark = Override). */
export function applyAppearance(appearance: Appearance): void {
  document.documentElement.setAttribute('data-appearance', appearance);
}

/** Theme-Name als `data-theme` (Skin-Achse; default = keine Akzent-Overrides). */
export function applyThemeId(id: string): void {
  document.documentElement.setAttribute('data-theme', id);
}

/** Effektive Erscheinung: ein Single-Appearance-Theme erzwingt seine Erscheinung,
 *  ohne die gespeicherte Nutzer-Präferenz zu überschreiben (Entkopplung). */
export function effectiveAppearance(themeId: string, stored: Appearance): Appearance {
  return forcedAppearance(getTheme(themeId)) ?? stored;
}

function emitChange(): void {
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Dark/Light umschalten — ändert NUR die Erscheinung, NIE das Theme. */
export function setAppearance(appearance: Appearance): void {
  localStorage.setItem(APPEARANCE_KEY, appearance);
  applyAppearance(effectiveAppearance(getStoredThemeId(), appearance));
  emitChange();
}

/** Theme wählen — ersetzt den Token-Satz live; die gespeicherte Dark/Light-
 *  Präferenz bleibt erhalten, die effektive Erscheinung wird neu aufgelöst. */
export function setThemeId(id: string): void {
  localStorage.setItem(THEME_KEY, id);
  applyThemeId(id);
  applyAppearance(effectiveAppearance(id, getStoredAppearance()));
  emitChange();
}

/** Call once per window at startup: apply the stored state now (no flash) and
 *  keep this window in sync when another window changes it. */
export function initTheme(): void {
  const themeId = getStoredThemeId();
  applyThemeId(themeId);
  applyAppearance(effectiveAppearance(themeId, getStoredAppearance()));
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && e.newValue) {
      applyThemeId(e.newValue);
      applyAppearance(effectiveAppearance(e.newValue, getStoredAppearance()));
    } else if (e.key === APPEARANCE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      applyAppearance(effectiveAppearance(getStoredThemeId(), e.newValue));
    }
  });
}
