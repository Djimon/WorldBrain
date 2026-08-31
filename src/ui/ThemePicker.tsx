import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';
import { mkdir } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { Button, Segmented } from './primitives';
import { getStoredThemeId, setThemeId, THEME_CHANGE_EVENT } from '../theme';
import { listThemes, previewAccent } from '../styles/theme-registry';

// #388-Follow-up: den Ordner öffnen, in den User-Theme-Dateien gehören
// (<appDataDir>/themes/). Ordner sicherstellen, dann im OS-Dateimanager öffnen;
// wenn openPath nicht erlaubt/verfügbar ist, auf revealItemInDir zurückfallen.
// In Nicht-Tauri-Umgebungen (Test/Browser) scheitert der Aufruf → guarded.
async function openThemesFolder(): Promise<void> {
  try {
    const dir = await join(await appDataDir(), 'themes');
    await mkdir(dir, { recursive: true }).catch(() => { /* existiert bereits */ });
    try {
      await openPath(dir);
    } catch {
      await revealItemInDir(dir);
    }
  } catch (err) {
    console.warn('[themes-folder]', err);
  }
}

// M17-S04 (#385): Theme-Auswahl — eigener Bedienpfad, getrennt vom Dark/Light-
// Umschalter (Entkopplung, Decision 5). Ein Theme-Wechsel ersetzt den Token-Satz
// live ohne Reload; der aktive Shell-Modus bleibt unverändert.
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
              {/* Live-Vorschau: der repräsentative Akzent des Themes als Swatch —
                  die dynamische Farbe reist über die CSS-Variable, kein Hex im JSX. */}
              <span className="theme-picker__swatch" aria-hidden="true"
                style={{ '--swatch': previewAccent(th) } as CSSProperties} />
              {t(th.labelKey, th.defaultLabel)}
            </span>
          ),
        }))}
      />
      {/* #388-Follow-up: schneller Zugang zum Import-Ordner für eigene Theme-Dateien. */}
      <Button variant="outline" onClick={() => void openThemesFolder()}>
        {t('themesFolderOpen', 'Themes-Ordner öffnen')}
      </Button>
    </div>
  );
}
