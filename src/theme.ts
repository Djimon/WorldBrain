// Shared theme handling for every window (main + detached soundboard/player
// WebviewWindows). Each window loads main.tsx and must apply the persisted
// theme to its OWN <html>; the main window's ThemeToggle only mutates its own
// document, so detached windows rely on initTheme() at startup + a cross-window
// storage listener for live updates.

export type Theme = 'light' | 'dark' | 'toxic';

// Themes reachable via the ThemeToggle click-cycle. 'toxic' is intentionally
// left out (deactivated) but kept fully supported — activate it for testing via
// devtools (`document.documentElement.dataset.theme = 'toxic'`) or by setting
// localStorage 'theme' to 'toxic'. Its override file (styles/themes/toxic.css)
// stays imported. Re-add 'toxic' here to put it back in the cycle.
export const THEME_ORDER: Theme[] = ['light', 'dark'];

export function getStoredTheme(): Theme {
  const t = localStorage.getItem('theme');
  return t === 'light' || t === 'dark' || t === 'toxic' ? t : 'dark';
}

/** Apply a theme to this window's <html>. Light is the bare `:root` default
 *  (no attribute); every other theme is a `data-theme="…"` override file. */
export function applyTheme(theme: string): void {
  if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/** Call once per window at startup: apply the stored theme now (no flash), and
 *  keep this window in sync when another window changes it. The 'storage' event
 *  fires only in OTHER same-origin windows, which is exactly how a toggle in the
 *  main window reaches the detached soundboard/player windows. */
export function initTheme(): void {
  applyTheme(getStoredTheme());
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && e.newValue) applyTheme(e.newValue);
  });
}
