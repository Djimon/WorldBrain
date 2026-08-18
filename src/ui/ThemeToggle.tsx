import { useEffect, useState } from 'react';
import { applyTheme, getStoredTheme, THEME_ORDER, type Theme } from '../theme';

const LABEL: Record<Theme, string> = { light: '☀️', dark: '🌙', toxic: '🧪' };
const NEXT_TITLE: Record<Theme, string> = {
  light: 'Dark mode',
  dark: 'Toxic theme',
  toxic: 'Light mode',
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    applyTheme(theme);
  }, [theme]);

  const next = () => setTheme((t) => THEME_ORDER[(THEME_ORDER.indexOf(t) + 1) % THEME_ORDER.length]);

  return (
    <button
      className="theme-toggle"
      aria-label={NEXT_TITLE[theme]}
      title={NEXT_TITLE[theme]}
      onClick={next}
    >
      {LABEL[theme]}
    </button>
  );
}
