import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { Button, Segmented } from './primitives';
import { getStoredThemeId, setThemeId, THEME_CHANGE_EVENT } from '../theme';
import { listThemes, previewAccent } from '../styles/theme-registry';

// #388 follow-up: open the folder where user theme files belong
// (<appDataDir>/themes/). Ensure the folder exists, then open it in the OS file manager;
// if openPath is not permitted/available, fall back to revealItemInDir.
// In non-Tauri environments (test/browser) the call fails → guarded.
async function openThemesFolder(): Promise<void> {
  try {
    const dir = await join(await appDataDir(), 'themes');
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

  return (
    <div className="theme-picker u-stack u-gap-2">
      <Segmented
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
      {/* #388 follow-up: quick access to the import folder for your own theme files. */}
      <Button variant="outline" onClick={() => void openThemesFolder()}>
        {t('themesFolderOpen', 'Themes-Ordner öffnen')}
      </Button>
    </div>
  );
}
