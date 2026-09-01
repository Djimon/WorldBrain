// #410 (Settings UX-Sprint): Variant A — sidebar + detail settings screen.
// Replaces the old flex-row `case 'project'` render. Category state drives which
// detail pane shows. Composed from design-system primitives (ListSurface/ListRow,
// StatusChip, Panel, Button) + utilities + tokens; component CSS only carries the
// structural one-offs (the shell grid, stat-tile grid, empty states).
// Mini-features (project stats, switcher) come from existing services.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appDataDir } from '@tauri-apps/api/path';
import { stat } from '@tauri-apps/plugin-fs';
import { openPath } from '@tauri-apps/plugin-opener';
import { version as appVersion } from '../../package.json';
import { useDatabase } from '../services/DatabaseContext';
import { readAppConfig } from '../services/app-config-service';
import type { ProjectEntry } from '../services/app-config-service';
import { Button, Panel, StatusChip, ListSurface, ListRow } from './primitives';
import { ThemePicker } from './ThemePicker';
import { SnapshotManager } from './SnapshotManager';

type Category = 'project' | 'plugins' | 'appearance' | 'backup' | 'shortcuts' | 'about';

export interface SettingsPanelProps {
  projectId: string;
  projectTitle?: string;
  projectDir: string;
  snapshotsDir: string;
  onProjectClose?: () => void;
  onOpenProject?: (projectId: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const CATS: readonly { id: Category; icon: string; soon?: boolean }[] = [
  { id: 'project', icon: '📁' },
  { id: 'plugins', icon: '🔌', soon: true },
  { id: 'appearance', icon: '🎨' },
  { id: 'backup', icon: '💾' },
  { id: 'shortcuts', icon: '⌨️', soon: true },
  { id: 'about', icon: 'ℹ️' },
];

export function SettingsPanel({ projectId, projectTitle, projectDir, snapshotsDir, onProjectClose, onOpenProject }: SettingsPanelProps) {
  const { t, i18n } = useTranslation('nav');
  const database = useDatabase();
  const [cat, setCat] = useState<Category>('project');
  const [stats, setStats] = useState<{ db: string; entities: number; maps: number } | null>(null);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [dataDir, setDataDir] = useState<string>('');

  // Project stats — DB file size + row counts (guarded; stays null on non-Tauri/test).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let db = '—';
      try { db = formatBytes((await stat(`${projectDir}/world.db`)).size); } catch { /* not in Tauri */ }
      let entities = 0, maps = 0;
      try {
        entities = (await database.select<{ n: number }>('SELECT COUNT(*) AS n FROM base_entities'))[0]?.n ?? 0;
        maps = (await database.select<{ n: number }>('SELECT COUNT(*) AS n FROM maps'))[0]?.n ?? 0;
      } catch { /* table may be absent in some harnesses */ }
      if (!cancelled) setStats({ db, entities, maps });
    })();
    return () => { cancelled = true; };
  }, [database, projectDir]);

  // Project list for the switcher + data-folder path.
  useEffect(() => {
    let cancelled = false;
    void readAppConfig().then((c) => { if (!cancelled) setProjects(c.projects); }).catch(() => { /* no config yet */ });
    void appDataDir().then((d) => { if (!cancelled) setDataDir(d); }).catch(() => { /* not in Tauri */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="settings">
      <header className="settings__topbar">
        <span className="settings__title">{t('project')}</span>
        <StatusChip>v{appVersion}</StatusChip>
      </header>
      <div className="settings__body">
        <nav className="settings__nav" aria-label={t('settingsNavAria', 'Einstellungen')}>
          <div className="settings__nav-title">{t('settingsNavAria', 'Einstellungen')}</div>
          <div className="u-stack u-gap-1">
            {CATS.map((c) => (
              <ListRow key={c.id} as="button" selected={cat === c.id} aria-current={cat === c.id} onClick={() => setCat(c.id)}>
                <span className="settings__nav-icon" aria-hidden="true">{c.icon}</span>
                <span className="settings__nav-label">{t(`settingsCat.${c.id}`)}</span>
                {c.soon && <StatusChip tone="warning">{t('settingsSoon', 'Bald')}</StatusChip>}
              </ListRow>
            ))}
          </div>
        </nav>

        <div className="settings__detail">
          {cat === 'project' && (
            <section className="settings__pane u-stack u-gap-4">
              <div>
                <h2 className="settings__pane-title">{projectTitle ?? projectId}</h2>
                {dataDir && <div className="settings__path">{dataDir}projects</div>}
              </div>
              <div className="settings__stats">
                <Panel className="settings__stat"><div className="settings__stat-n">{stats ? stats.db : '—'}</div><div className="settings__stat-l">{t('settingsStat.database', 'Datenbank')}</div></Panel>
                <Panel className="settings__stat"><div className="settings__stat-n">{stats ? stats.entities : '—'}</div><div className="settings__stat-l">{t('settingsStat.entities', 'Entitäten')}</div></Panel>
                <Panel className="settings__stat"><div className="settings__stat-n">{stats ? stats.maps : '—'}</div><div className="settings__stat-l">{t('settingsStat.maps', 'Karten')}</div></Panel>
              </div>
              {projects.length > 1 && (
                <div className="u-stack u-gap-2">
                  <div className="settings__block-label">{t('settingsSwitchProject', 'Projekt wechseln')}</div>
                  <ListSurface>
                    {projects.map((p) => {
                      const active = p.id === projectId;
                      return (
                        <ListRow key={p.id} as="button" selected={active} interactive={!active} aria-disabled={active || undefined} onClick={() => { if (!active) onOpenProject?.(p.id); }}>
                          <span className="u-flex-1">{p.title}</span>
                          <StatusChip tone={active ? 'accent' : 'muted'}>{active ? t('settingsActive', 'Aktiv') : t('settingsOpenProject', 'Öffnen')}</StatusChip>
                        </ListRow>
                      );
                    })}
                  </ListSurface>
                </div>
              )}
              <hr className="settings__divider" />
              <Button tone="danger" variant="outline" onClick={() => onProjectClose?.()}>{t('closeProject')}</Button>
            </section>
          )}

          {cat === 'appearance' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.appearance')}</h2>
              <ThemePicker />
            </section>
          )}

          {cat === 'backup' && (
            <section className="settings__pane">
              <SnapshotManager projectId={projectId} projectDir={projectDir} snapshotsDir={snapshotsDir} onRestored={onProjectClose ?? (() => {})} />
            </section>
          )}

          {cat === 'about' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.about')}</h2>
              <dl className="settings__about">
                <div><dt>{t('settingsAbout.version', 'Version')}</dt><dd>{t('brand.platform', { ns: 'common' })} {appVersion}</dd></div>
                <div><dt>{t('settingsAbout.engine', 'Engine')}</dt><dd>{t('brand.engine', { ns: 'common' })}</dd></div>
                <div><dt>{t('settingsAbout.language', 'Sprache')}</dt><dd>{i18n.language === 'en' ? 'English' : 'Deutsch'}</dd></div>
                {dataDir && (
                  <div><dt>{t('settingsAbout.dataFolder', 'Datenordner')}</dt>
                    <dd className="settings__datafolder">
                      <span className="settings__path">{dataDir}</span>
                      <Button variant="ghost" size="compact" onClick={() => void openPath(dataDir).catch(() => { /* not in Tauri */ })}>{t('settingsOpenFolder', 'Öffnen')}</Button>
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          {(cat === 'plugins' || cat === 'shortcuts') && (
            <section className="settings__pane settings__soon">
              <div className="settings__soon-emoji" aria-hidden="true">{cat === 'plugins' ? '🔌' : '⌨️'}</div>
              <StatusChip tone="warning">{t('settingsSoon', 'Bald')}</StatusChip>
              <h2 className="settings__pane-title">{cat === 'plugins' ? t('settingsPlugins.title') : t('settingsShortcuts.title')}</h2>
              <p className="settings__soon-body">{cat === 'plugins' ? t('settingsPlugins.body') : t('settingsShortcuts.body')}</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
