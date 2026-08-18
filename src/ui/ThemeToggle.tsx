import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'toxic';

const ORDER: Theme[] = ['light', 'dark', 'toxic'];
const LABEL: Record<Theme, string> = { light: '☀️', dark: '🌙', toxic: '🧪' };
const NEXT_TITLE: Record<Theme, string> = {
  light: 'Dark mode',
  dark: 'Toxic theme',
  toxic: 'Light mode',
};

function getStoredTheme(): Theme {
  const t = localStorage.getItem('theme');
  return t === 'light' || t === 'dark' || t === 'toxic' ? t : 'dark';
}

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  localStorage.setItem('theme', theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const next = () => setTheme((t) => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]);

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
