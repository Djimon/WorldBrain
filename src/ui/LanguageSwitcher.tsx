import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'de', label: 'Deutsch' },
  { code: 'en', label: 'English' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <select
      className="language-switcher"
      value={i18n.language}
      onChange={(e) => { void i18n.changeLanguage(e.target.value); }}
      aria-label="Sprache / Language"
    >
      {LANGUAGES.map(({ code, label }) => (
        <option key={code} value={code}>{label}</option>
      ))}
    </select>
  );
}
