import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Segmented } from './primitives';
import { getStoredThemeId, setThemeId, THEME_CHANGE_EVENT } from '../theme';
import { listThemes } from '../styles/theme-registry';

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
      options={listThemes().map((th) => ({ id: th.id, label: t(th.labelKey, th.defaultLabel) }))}
    />
  );
}
