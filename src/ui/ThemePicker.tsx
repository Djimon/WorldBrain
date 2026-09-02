import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { mkdir } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { userThemesDir } from '../services/user-data-dir';
import { scanUserThemes } from '../services/user-theme-loader';
import { Button, Segmented } from './primitives';
import { getStoredThemeId, setThemeId, THEME_CHANGE_EVENT } from '../theme';
import { listThemes, previewAccent } from '../styles/theme-registry';

// #388 follow-up: open the folder where user theme files belong
// (Documents\WorldsAndBeyond\themes\, #406). Ensure the folder exists, then open it in the OS file manager;
// if openPath is not permitted/available, fall back to revealItemInDir.
// In non-Tauri environments (test/browser) the call fails → guarded.
async function openThemesFolder(): Promise<void> {
  try {
    const dir = await userThemesDir();
    await mkdir(dir, { recursive: true }).catch(() => { /* already exists */ });
    try {
      await openPath(dir);
    } catch {
      await revealItemInDir(dir);
    }
  } catch (err) {
    console.warn('[themes-folder]', err);
  }
}

// M17-S04 (#385): theme selection — its own control path, separate from the dark/light
// toggle (decoupling, Decision 5). A theme change replaces the token set
// live without a reload; the active shell mode stays unchanged.
export function ThemePicker() {
  const { t } = useTranslation();
  const [themeId, setThemeIdState] = useState<string>(getStoredThemeId);
  // #410 UX: bump to re-render the theme list after a live folder re-scan, so newly
  // dropped-in theme files show up as buttons without an app restart.
  const [reloadTick, setReloadTick] = useState(0);
  const [reloadMsg, setReloadMsg] = useState<string | null>(null);

  useEffect(() => {
    const onChange = () => setThemeIdState(getStoredThemeId());
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  function pick(id: string) {
    if (id === themeId) return;
    setThemeIdState(id);
    setThemeId(id);
  }

  // #410 UX: re-scan the themes folder live (no restart). scanUserThemes registers any
  // new/changed *.json themes into the registry; the tick re-renders the switcher.
  async function reloadThemes() {
    try {
      const dir = await userThemesDir();
      const before = listThemes().length;
      await scanUserThemes(dir);
      setReloadTick((n) => n + 1);
      const total = listThemes().length;
      const added = total - before;
      setReloadMsg(
        added > 0
          ? t('themesReloadedAdded', { count: added, defaultValue: 'Neu geladen: {{count}}' })
          : t('themesReloadedNone', 'Keine neuen Themes gefunden.'),
      );
    } catch {
      setReloadMsg(t('themesReloadFailed', 'Themes-Ordner nicht lesbar.'));
    }
  }

  return (
    <div className="theme-picker u-stack u-gap-3">
      {/* Theme switcher — the built-in + imported themes you can switch between live. */}
      <div className="u-stack u-gap-1">
        <span className="theme-picker__group-label">{t('themePickerLabel', 'Theme')}</span>
        <Segmented
          key={`themes-${reloadTick}`}
          label={t('themePickerLabel', 'Theme')}
          value={themeId}
          onChange={pick}
          size="compact"
          options={listThemes().map((th) => ({
            id: th.id,
            label: (
              <span className="theme-picker__option">
                {/* Live preview: the theme's representative accent as a swatch —
                    the dynamic color travels via the CSS variable, no hex in the JSX. */}
                <span className="theme-picker__swatch" aria-hidden="true"
                  style={{ '--swatch': previewAccent(th) } as CSSProperties} />
                {t(th.labelKey, th.defaultLabel)}
              </span>
            ),
          }))}
        />
      </div>

      {/* Own themes — drop .json theme files in the folder, then re-scan to add them
          above as more buttons (no app restart needed). */}
      <div className="u-stack u-gap-1">
        <span className="theme-picker__group-label">{t('themesOwnLabel', 'Eigene Themes')}</span>
        <p className="theme-picker__hint">
          {t('themesOwnHint', 'Lege eigene .json-Theme-Dateien in den Ordner und lies sie neu ein — sie erscheinen oben als weitere Buttons.')}
        </p>
        <div className="u-row u-gap-2 u-wrap">
          <Button variant="outline" onClick={() => void openThemesFolder()}>
            {t('themesFolderOpen', 'Themes-Ordner öffnen')}
          </Button>
          <Button variant="outline" onClick={() => void reloadThemes()}>
            {t('themesReload', 'Themes neu einlesen')}
          </Button>
        </div>
        {reloadMsg !== null && (
          <p className="theme-picker__hint" role="status">{reloadMsg}</p>
        )}
      </div>
    </div>
  );
}
