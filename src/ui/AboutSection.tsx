import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { appVersion, appBuild } from '../branding/version';
import { COPYRIGHT_START_YEAR } from '../branding/brand';
import { userDataDir } from '../services/user-data-dir';
import { Button } from './primitives';

/** Shared "About" section for both settings screens (edit + play). Play needs it too
 *  because a light player-only edition is planned, where this is the only place the
 *  version / company / data folder is shown. Self-contained (fetches its own data folder). */
async function openFolder(path: string): Promise<void> {
  try {
    try { await openPath(path); }
    catch { await revealItemInDir(path); }
  } catch (err) {
    console.warn('[about] openFolder', err);
  }
}

export function AboutSection() {
  const { t, i18n } = useTranslation('nav');
  const [dataDir, setDataDir] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void userDataDir().then((d) => { if (!cancelled) setDataDir(d); }).catch(() => { /* not in Tauri */ });
    return () => { cancelled = true; };
  }, []);

  const currentYear = new Date().getFullYear();
  const years = currentYear > COPYRIGHT_START_YEAR ? `${COPYRIGHT_START_YEAR}–${currentYear}` : `${COPYRIGHT_START_YEAR}`;
  const company = t('brand.company', { ns: 'common' });
  const copyrightLine = t('settingsCopyright', {
    years,
    company,
    defaultValue: '© {{years}} {{company}}. Alle Rechte vorbehalten.',
  });

  return (
    <section className="settings__pane u-stack u-gap-3">
      <h2 className="settings__pane-title">{t('settingsCat.about')}</h2>
      <dl className="settings__about">
        <div><dt>{t('settingsAbout.version', 'Version')}</dt><dd>{t('brand.platform', { ns: 'common' })} v{appVersion} · {t('settingsAbout.build', 'Build')} {appBuild}</dd></div>
        <div><dt>{t('settingsAbout.company', 'Firma')}</dt><dd>{company}</dd></div>
        <div><dt>{t('settingsAbout.language', 'Sprache')}</dt><dd>{i18n.language === 'en' ? 'English' : 'Deutsch'}</dd></div>
        {dataDir && (
          <div><dt>{t('settingsAbout.dataFolder', 'Datenordner')}</dt>
            <dd className="settings__datafolder">
              <span className="settings__path">{dataDir}</span>
              <Button variant="ghost" size="compact" onClick={() => void openFolder(dataDir)}>{t('settingsOpenFolder', 'Öffnen')}</Button>
            </dd>
          </div>
        )}
      </dl>
      <p className="settings__copyright">{copyrightLine}</p>
    </section>
  );
}
