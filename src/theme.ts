// Shared theme handling for every window (main + detached soundboard/player
// WebviewWindows). Each window applies the persisted state to its OWN <html>.
//
// M17-S04 (#385): decoupling — appearance (dark/light) and theme (default/teal)
// are TWO orthogonal axes with separate persistence keys and separate
// DOM attributes (Decision 5). A dark/light switch NEVER changes the theme and
// vice versa. A single-appearance theme (e.g. Teal = dark) forces its
// appearance; the dark/light toggle then has no effect.
import { userThemesDir } from './services/user-data-dir';
import { getTheme, forcedAppearance, type Appearance, type ShellMode } from './styles/theme-registry';
import { scanUserThemes } from './services/user-theme-loader';

const APPEARANCE_KEY = 'appearance';
const THEME_KEY = 'theme';

/** Attribute in which the applier remembers the names of the currently inline-set
 *  user-theme vars — so a theme switch can cleanly clear them again (#388). */
const USER_VARS_ATTR = 'data-user-theme-vars';

/** In-window signal that theme/appearance has changed (storage fires only
 *  in OTHER windows; sibling controls in the same window listen for this). */
export const THEME_CHANGE_EVENT = 'wbx:themechange';

export function getStoredAppearance(): Appearance {
  const a = localStorage.getItem(APPEARANCE_KEY);
  return a === 'light' || a === 'dark' ? a : 'dark';
}

export function getStoredThemeId(): string {
  return localStorage.getItem(THEME_KEY) ?? 'default';
}

/** Appearance as `data-appearance` (light = bare :root palette, dark = override). */
export function applyAppearance(appearance: Appearance): void {
  document.documentElement.setAttribute('data-appearance', appearance);
}

/** Theme name as `data-theme` (skin axis; default = no accent overrides). */
export function applyThemeId(id: string): void {
  document.documentElement.setAttribute('data-theme', id);
}

/** Effective appearance: a single-appearance theme forces its appearance,
 *  without overriding the stored user preference (decoupling). */
export function effectiveAppearance(themeId: string, stored: Appearance): Appearance {
  return forcedAppearance(getTheme(themeId)) ?? stored;
}

/** #388 — JS applier for imported user themes. Reads data-theme/-appearance/
 *  -mode from documentElement, resolves from the registry (palette of the active
 *  appearance + accents of the active mode) and sets ALL override vars INLINE
 *  on documentElement. Built-in themes (default/teal) are CSS-driven →
 *  the applier sets nothing inline and clears previously set vars, so that the
 *  cascade takes effect again. Idempotent; called on every theme/appearance/mode
 *  switch. */
export function applyThemeVars(): void {
  const el = document.documentElement;
  // Remove the last set inline vars (switching away from a user theme).
  const prev = el.getAttribute(USER_VARS_ATTR);
  if (prev) {
    for (const name of prev.split(' ')) if (name) el.style.removeProperty(name);
    el.removeAttribute(USER_VARS_ATTR);
  }
  const theme = getTheme(el.getAttribute('data-theme') ?? getStoredThemeId());
  if (theme.builtin || !theme.skins) return; // CSS-driven → nothing inline
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
  // unified → shared set (under 'edit'); per-mode → set of the active mode.
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

/** Toggle dark/light — changes ONLY the appearance, NEVER the theme. */
export function setAppearance(appearance: Appearance): void {
  localStorage.setItem(APPEARANCE_KEY, appearance);
  applyAppearance(effectiveAppearance(getStoredThemeId(), appearance));
  applyThemeVars(); // user theme: apply the set of the new appearance
  emitChange();
}

/** Select a theme — replaces the token set live; the stored dark/light
 *  preference is retained, the effective appearance is re-resolved. */
export function setThemeId(id: string): void {
  localStorage.setItem(THEME_KEY, id);
  applyThemeId(id);
  applyAppearance(effectiveAppearance(id, getStoredAppearance()));
  applyThemeVars(); // user theme → set inline; built-in → clear inline
  emitChange();
}

/** Apply the stored state (theme + effective appearance + user-theme vars)
 *  to this window. Used by `initTheme` and called again after the startup scan
 *  of the user themes (#388) — then a previously stored
 *  user theme actually resolves (at init it was not yet registered). */
export function applyStoredTheme(): void {
  const themeId = getStoredThemeId();
  applyThemeId(themeId);
  applyAppearance(effectiveAppearance(themeId, getStoredAppearance()));
  applyThemeVars();
}

/**
 * #393 — register importable user themes for THIS window and then apply the
 * stored theme again. Called per window in the bootstrap
 * (main.tsx) so that detached windows (soundboard/player) ALSO render an active
 * user theme identically — each window has its own JS context with
 * its own (initially empty) registry. Without Tauri (test/browser) a no-op.
 */
export async function bootstrapUserThemes(): Promise<void> {
  try {
    const themesDir = await userThemesDir();
    const scan = await scanUserThemes(themesDir);
    if (scan.registered.length > 0) applyStoredTheme();
  } catch {
    // no Tauri / no documentDir → only built-in themes (no error).
  }
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
