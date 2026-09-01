import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getStoredAppearance,
  getStoredThemeId,
  setAppearance,
  THEME_CHANGE_EVENT,
} from '../theme';
import { getTheme, forcedAppearance, type Appearance } from '../styles/theme-registry';

// M17-S04 (#385): the toggle controls ONLY the appearance (dark/light), NEVER the
// theme (decoupling, Decision 5). For a single-appearance theme (e.g. Teal =
// dark) the theme forces its appearance → the toggle is disabled.
export function ThemeToggle() {
  const { t } = useTranslation();
  const [appearance, setAppearanceState] = useState<Appearance>(getStoredAppearance);
  const [themeId, setThemeIdState] = useState<string>(getStoredThemeId);

  // React to a theme change (via the ThemePicker) so the disabled state
  // updates live.
  useEffect(() => {
    const onChange = () => {
      setThemeIdState(getStoredThemeId());
      setAppearanceState(getStoredAppearance());
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  const forced = forcedAppearance(getTheme(themeId)); // null = freely selectable
  const disabled = forced !== null;
  const shown = forced ?? appearance;

  function toggle() {
    if (disabled) return;
    const next: Appearance = appearance === 'dark' ? 'light' : 'dark';
    setAppearanceState(next);
    setAppearance(next);
  }

  const title = disabled
    ? t('appearanceForced', 'Erscheinung vom Theme vorgegeben')
    : shown === 'dark'
      ? t('appearanceToLight', 'Helle Erscheinung')
      : t('appearanceToDark', 'Dunkle Erscheinung');

  return (
    <button
      className="theme-toggle"
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={toggle}
    >
      {shown === 'dark' ? '🌙' : '☀️'}
    </button>
  );
}
