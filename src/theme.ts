// Shared theme handling for every window (main + detached soundboard/player
// WebviewWindows). Each window applies the persisted state to its OWN <html>.
//
// M17-S04 (#385): Entkopplung — Erscheinung (dark/light) und Theme (default/teal)
// sind ZWEI orthogonale Achsen mit getrennten Persistenz-Keys und getrennten
// DOM-Attributen (Decision 5). Ein Dark/Light-Wechsel ändert NIE das Theme und
// umgekehrt. Ein Single-Appearance-Theme (z.B. Teal = dark) erzwingt seine
// Erscheinung; der Dark/Light-Umschalter ist dann wirkungslos.
import { getTheme, forcedAppearance, type Appearance, type ShellMode } from './styles/theme-registry';

const APPEARANCE_KEY = 'appearance';
const THEME_KEY = 'theme';

/** Attribut, in dem der Applier die Namen der aktuell inline gesetzten User-Theme-
 *  Vars merkt — damit ein Theme-Wechsel sie sauber wieder abräumen kann (#388). */
const USER_VARS_ATTR = 'data-user-theme-vars';

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

/** #388 — JS-Applier für importierte User-Themes. Liest data-theme/-appearance/
 *  -mode vom documentElement, löst aus der Registry auf (Palette der aktiven
 *  Erscheinung + Accents des aktiven Modus) und setzt ALLE Override-Vars INLINE
 *  auf documentElement. Eingebaute Themes (default/teal) sind CSS-getrieben →
 *  der Applier setzt nichts inline und räumt zuvor gesetzte Vars ab, sodass die
 *  Kaskade wieder greift. Idempotent; bei jedem Theme-/Erscheinungs-/Modus-
 *  Wechsel aufgerufen. */
export function applyThemeVars(): void {
  const el = document.documentElement;
  // Zuletzt gesetzte Inline-Vars entfernen (Wechsel weg von einem User-Theme).
  const prev = el.getAttribute(USER_VARS_ATTR);
  if (prev) {
    for (const name of prev.split(' ')) if (name) el.style.removeProperty(name);
    el.removeAttribute(USER_VARS_ATTR);
  }
  const theme = getTheme(el.getAttribute('data-theme') ?? getStoredThemeId());
  if (theme.builtin || !theme.skins) return; // CSS-getrieben → nichts inline
  const appAttr = el.getAttribute('data-appearance');
  const appearance: Appearance = appAttr === 'light' ? 'light' : 'dark';
  const skin = theme.skins[appearance] ?? theme.skins.dark ?? theme.skins.light;
  if (!skin) return;
  const mode: ShellMode = el.getAttribute('data-mode') === 'play' ? 'play' : 'edit';
  const applied: string[] = [];
  for (const [name, value] of Object.entries(skin.palette ?? {})) {
    if (value == null) continue;
    el.style.setProperty(name, value);
    applied.push(name);
  }
  // unified → geteilter Satz (unter 'edit'); per-mode → Satz des aktiven Modus.
  const accents = theme.modeSupport === 'unified' ? skin.tokens.edit : (skin.tokens[mode] ?? skin.tokens.edit);
  if (accents) {
    for (const [name, value] of Object.entries(accents)) {
      el.style.setProperty(name, value);
      applied.push(name);
    }
  }
  if (applied.length) el.setAttribute(USER_VARS_ATTR, applied.join(' '));
}

function emitChange(): void {
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

/** Dark/Light umschalten — ändert NUR die Erscheinung, NIE das Theme. */
export function setAppearance(appearance: Appearance): void {
  localStorage.setItem(APPEARANCE_KEY, appearance);
  applyAppearance(effectiveAppearance(getStoredThemeId(), appearance));
  applyThemeVars(); // User-Theme: den Satz der neuen Erscheinung anwenden
  emitChange();
}

/** Theme wählen — ersetzt den Token-Satz live; die gespeicherte Dark/Light-
 *  Präferenz bleibt erhalten, die effektive Erscheinung wird neu aufgelöst. */
export function setThemeId(id: string): void {
  localStorage.setItem(THEME_KEY, id);
  applyThemeId(id);
  applyAppearance(effectiveAppearance(id, getStoredAppearance()));
  applyThemeVars(); // User-Theme → inline setzen; Built-in → inline abräumen
  emitChange();
}

/** Den gespeicherten Zustand (Theme + effektive Erscheinung + User-Theme-Vars)
 *  auf dieses Fenster anwenden. Von `initTheme` genutzt und nach dem Startup-Scan
 *  der User-Themes erneut aufgerufen (#388) — dann löst ein zuvor gespeichertes
 *  User-Theme wirklich auf (bei init war es noch nicht registriert). */
export function applyStoredTheme(): void {
  const themeId = getStoredThemeId();
  applyThemeId(themeId);
  applyAppearance(effectiveAppearance(themeId, getStoredAppearance()));
  applyThemeVars();
}

/** Call once per window at startup: apply the stored state now (no flash) and
 *  keep this window in sync when another window changes it. */
export function initTheme(): void {
  applyStoredTheme();
  window.addEventListener('storage', (e) => {
    if (e.key === THEME_KEY && e.newValue) {
      applyThemeId(e.newValue);
      applyAppearance(effectiveAppearance(e.newValue, getStoredAppearance()));
      applyThemeVars();
    } else if (e.key === APPEARANCE_KEY && (e.newValue === 'light' || e.newValue === 'dark')) {
      applyAppearance(effectiveAppearance(getStoredThemeId(), e.newValue));
      applyThemeVars();
    }
  });
}
