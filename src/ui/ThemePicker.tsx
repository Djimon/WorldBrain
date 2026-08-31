import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { CSSProperties } from 'react';
import { Segmented } from './primitives';
import { getStoredThemeId, setThemeId, THEME_CHANGE_EVENT } from '../theme';
import { listThemes, previewAccent } from '../styles/theme-registry';

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
  );
}
