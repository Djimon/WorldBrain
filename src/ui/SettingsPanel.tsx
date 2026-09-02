// #410 (Settings UX-Sprint): Variant A — sidebar + detail settings screen.
// Replaces the old flex-row `case 'project'` render. Category state drives which
// detail pane shows. Composed from design-system primitives (ListSurface/ListRow,
// StatusChip, Panel, Button) + utilities + tokens; component CSS only carries the
// structural one-offs (the shell grid, stat-tile grid, empty states).
// Mini-features (project stats, switcher) come from existing services.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { appDataDir, join } from '@tauri-apps/api/path';
import { stat } from '@tauri-apps/plugin-fs';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { version as appVersion } from '../../package.json';
import { ENGINE_VERSION, COPYRIGHT_START_YEAR } from '../branding/brand';
import { useDatabase } from '../services/DatabaseContext';
import { readAppConfig, registerProject } from '../services/app-config-service';
import type { ProjectEntry } from '../services/app-config-service';
import { readProjectMeta, updateProjectMeta } from '../services/project-service';
import { userDataDir } from '../services/user-data-dir';
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
  /** Called after a successful title edit so the shell/header can reflect it live. */
  onProjectRenamed?: (title: string) => void;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Open a folder in the OS file manager. `openPath` throws for directories in some
// setups, so fall back to `revealItemInDir` (same pattern as ThemePicker). Guarded
// so non-Tauri (test/browser) just no-ops.
async function openFolder(path: string): Promise<void> {
  try {
    try { await openPath(path); }
    catch { await revealItemInDir(path); }
  } catch (err) {
    console.warn('[settings] openFolder', err);
  }
}

const CATS: readonly { id: Category; icon: string; soon?: boolean }[] = [
  { id: 'project', icon: '📁' },
  { id: 'plugins', icon: '🔌', soon: true },
  { id: 'appearance', icon: '🎨' },
  { id: 'backup', icon: '💾' },
  { id: 'shortcuts', icon: '⌨️', soon: true },
  { id: 'about', icon: 'ℹ️' },
];

export function SettingsPanel({ projectId, projectTitle, projectDir, snapshotsDir, onProjectClose, onOpenProject, onProjectRenamed }: SettingsPanelProps) {
  const { t, i18n } = useTranslation('nav');
  // "© 2026 …" while still 2026; widens to "2026–<year>" once the year rolls over.
  const currentYear = new Date().getFullYear();
  const copyrightYears = currentYear > COPYRIGHT_START_YEAR ? `${COPYRIGHT_START_YEAR}–${currentYear}` : `${COPYRIGHT_START_YEAR}`;
  const companyName = t('brand.company', { ns: 'common' });
  const copyrightLine = t('settingsCopyright', {
    years: copyrightYears,
    company: companyName,
    defaultValue: '© {{years}} {{company}}. Alle Rechte vorbehalten.',
  });
  const database = useDatabase();
  const [cat, setCat] = useState<Category>('project');
  const [stats, setStats] = useState<{ db: string; entities: number | null; maps: number | null } | null>(null);
  const [projects, setProjects] = useState<ProjectEntry[]>([]);
  const [dataDir, setDataDir] = useState<string>('');
  // Editable project metadata (title/description) loaded from project.json.
  const [title, setTitle] = useState<string>(projectTitle ?? projectId);
  const [description, setDescription] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [saving, setSaving] = useState(false);
  // Two-step switcher: a row click only PREVIEWS that project here; the actual switch
  // happens on the explicit "Open" button. Defaults to the current project.
  const [selectedId, setSelectedId] = useState<string>(projectId);
  const selectedEntry = projects.find((p) => p.id === selectedId);
  const isCurrent = selectedId === projectId;
  const selectedDir = isCurrent ? projectDir : (selectedEntry?.path ?? projectDir);

  // Project stats — DB file size + row counts (guarded; stays null on non-Tauri/test).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let db = '—';
      try { db = formatBytes((await stat(`${selectedDir}/world.db`)).size); } catch { /* not in Tauri */ }
      // Entity/map counts come from the OPEN db connection → only the current project.
      // A previewed other project shows its db size but "—" for counts.
      let entities: number | null = null, maps: number | null = null;
      if (isCurrent) {
        try {
          entities = (await database.select<{ n: number }>('SELECT COUNT(*) AS n FROM base_entities'))[0]?.n ?? 0;
          maps = (await database.select<{ n: number }>('SELECT COUNT(*) AS n FROM maps'))[0]?.n ?? 0;
        } catch { /* table may be absent in some harnesses */ }
      }
      if (!cancelled) setStats({ db, entities, maps });
    })();
    return () => { cancelled = true; };
  }, [database, selectedDir, isCurrent]);

  // Project list for the switcher + user-facing data folder.
  // app-config.json still lives at an ABSOLUTE <appDataDir>/app-config.json (internal,
  // same as App.tsx). readAppConfig()'s default is a RELATIVE path that does NOT resolve
  // there → it silently yields an empty list.
  // The displayed "data folder", however, is the user's own content (projects/themes/
  // plugins/help) which #406 moved to Documents\WorldsAndBeyond — NOT the internal AppData.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const base = await appDataDir();
        const c = await readAppConfig(await join(base, 'app-config.json'));
        if (!cancelled) setProjects(c.projects);
      } catch { /* not in Tauri */ }
      try {
        const userDir = await userDataDir();
        if (!cancelled) setDataDir(userDir);
      } catch { /* not in Tauri */ }
    })();
    return () => { cancelled = true; };
  }, []);

  // Project metadata (title/description) from project.json.
  useEffect(() => {
    let cancelled = false;
    void readProjectMeta(selectedDir).then((m) => {
      if (cancelled || !m) return;
      setTitle(m.title);
      setDescription(m.description ?? '');
    }).catch(() => { /* not in Tauri */ });
    return () => { cancelled = true; };
  }, [selectedDir]);

  function beginEdit() {
    setDraftTitle(title);
    setDraftDesc(description);
    setEditing(true);
  }

  async function saveEdit() {
    const nextTitle = draftTitle.trim();
    if (!nextTitle || saving) return;
    setSaving(true);
    try {
      await updateProjectMeta(selectedDir, { title: nextTitle, description: draftDesc });
      const entry = projects.find((p) => p.id === selectedId);
      if (entry) await registerProject({ ...entry, title: nextTitle }, await join(await appDataDir(), 'app-config.json'));
      setTitle(nextTitle);
      setDescription(draftDesc.trim());
      setProjects((prev) => prev.map((p) => (p.id === selectedId ? { ...p, title: nextTitle } : p)));
      if (isCurrent) onProjectRenamed?.(nextTitle);
      setEditing(false);
    } catch (e) {
      console.error('[SettingsPanel] saveEdit failed', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings">
      <header className="settings__topbar">
        {/* #410 UX: the screen title is "Einstellungen" (was "Projekt"); the redundant
            "Einstellungen" heading inside the side-nav is dropped (aria-label kept). */}
        <span className="settings__title">{t('settingsTitle', 'Einstellungen')}</span>
        <StatusChip>v{appVersion}</StatusChip>
      </header>
      <div className="settings__body">
        <nav className="settings__nav" aria-label={t('settingsTitle', 'Einstellungen')}>
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
              <div className="u-stack u-gap-2">
                <div className="settings__project-head">
                  <h2 className="settings__pane-title">{title}</h2>
                  {!editing && (
                    <Button variant="ghost" size="icon" onClick={beginEdit} aria-label={t('edit', { ns: 'common' })} title={t('edit', { ns: 'common' })}>✏️</Button>
                  )}
                </div>

                {editing ? (
                  <div className="u-stack u-gap-2">
                    <label className="settings__field">
                      <span className="settings__field-label">{t('settingsTitleLabel', 'Titel')}</span>
                      <input className="settings__input" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} autoFocus />
                    </label>
                    <label className="settings__field">
                      <span className="settings__field-label">{t('description', { ns: 'common' })}</span>
                      <textarea className="settings__textarea" value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} rows={3} />
                    </label>
                    <div className="u-row u-gap-2">
                      <Button onClick={() => void saveEdit()} disabled={saving || !draftTitle.trim()}>{t('save', { ns: 'common' })}</Button>
                      <Button variant="ghost" onClick={() => setEditing(false)}>{t('cancel', { ns: 'common' })}</Button>
                    </div>
                  </div>
                ) : (
                  <p className={description ? 'settings__project-desc' : 'settings__project-desc settings__muted'}>
                    {description || t('settingsNoDescription', 'Noch keine Beschreibung.')}
                  </p>
                )}

                {selectedDir && (
                  <div className="settings__datafolder">
                    <span className="settings__path"><span className="settings__path-label">{t('settingsProjectFolder', 'Projekt-Ordner')}:</span> {selectedDir}</span>
                    <Button variant="ghost" size="compact" onClick={() => void openFolder(selectedDir)}>{t('settingsOpenFolder', 'Öffnen')}</Button>
                  </div>
                )}
              </div>

              <div className="settings__stats">
                <Panel className="settings__stat"><div className="settings__stat-n">{stats ? stats.db : '—'}</div><div className="settings__stat-l">{t('settingsStat.database', 'Datenbank')}</div></Panel>
                <Panel className="settings__stat"><div className="settings__stat-n">{stats && stats.entities !== null ? stats.entities : '—'}</div><div className="settings__stat-l">{t('settingsStat.entities', 'Entitäten')}</div></Panel>
                <Panel className="settings__stat"><div className="settings__stat-n">{stats && stats.maps !== null ? stats.maps : '—'}</div><div className="settings__stat-l">{t('settingsStat.maps', 'Karten')}</div></Panel>
              </div>

              <hr className="settings__divider" />
              {isCurrent
                ? <Button tone="danger" variant="outline" onClick={() => onProjectClose?.()}>{t('closeProject')}</Button>
                : <Button variant="ghost" onClick={() => { setSelectedId(projectId); setTitle(projectTitle ?? projectId); setEditing(false); }}>{t('back', { ns: 'common' })}</Button>}

              {projects.length > 0 && (
                <div className="u-stack u-gap-2">
                  <div className="settings__block-label">{t('settingsSwitchProject', 'Projekt wechseln')}</div>
                  <ListSurface>
                    {projects.map((p) => (
                      <ListRow key={p.id} as="div" selected={p.id === selectedId} aria-current={p.id === selectedId} onClick={() => { setSelectedId(p.id); setTitle(p.title); setEditing(false); }}>
                        <span className="u-flex-1">{p.title}</span>
                        {p.id === projectId
                          ? <StatusChip tone="accent">{t('settingsActive', 'Aktiv')}</StatusChip>
                          : <Button size="compact" variant="outline" onClick={(e) => { e.stopPropagation(); onOpenProject?.(p.id); }}>{t('settingsOpenProject', 'Öffnen')}</Button>}
                      </ListRow>
                    ))}
                  </ListSurface>
                </div>
              )}
            </section>
          )}

          {cat === 'appearance' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.appearance')}</h2>
              <ThemePicker />
            </section>
          )}

          {cat === 'backup' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.backup')}</h2>
              {/* Backups are per-project (stored in <projectDir>\snapshots) — make the scope explicit. */}
              <p className="settings__backup-scope">{t('settingsBackupFor', { project: title, defaultValue: 'Backups für „{{project}}"' })}</p>
              <SnapshotManager projectId={projectId} projectDir={projectDir} snapshotsDir={snapshotsDir} onRestored={onProjectClose ?? (() => {})} />
              <hr className="settings__divider" />
              {/* Teaser: automatic backups are coming — centred "Soon" block, same as plugins/shortcuts. */}
              <div className="settings__soon">
                <div className="settings__soon-emoji" aria-hidden="true">⏱️</div>
                <StatusChip tone="warning">{t('settingsSoon', 'Bald')}</StatusChip>
                <h3 className="settings__pane-title">{t('settingsBackupAuto.title')}</h3>
                <p className="settings__soon-body">{t('settingsBackupAuto.body')}</p>
              </div>
            </section>
          )}

          {cat === 'about' && (
            <section className="settings__pane u-stack u-gap-3">
              <h2 className="settings__pane-title">{t('settingsCat.about')}</h2>
              <dl className="settings__about">
                <div><dt>{t('settingsAbout.version', 'Version')}</dt><dd>{t('brand.platform', { ns: 'common' })} {appVersion}</dd></div>
                <div><dt>{t('settingsAbout.company', 'Firma')}</dt><dd>{t('brand.company', { ns: 'common' })}</dd></div>
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
          )}

          {(cat === 'plugins' || cat === 'shortcuts') && (
            <section className="settings__pane settings__soon">
              {cat === 'plugins' && (
                /* Engine version lives with the plugin/rule system, not in About. */
                <span className="settings__corner-meta">
                  {t('settingsPluginsEngine', 'Engine-Version')}: {t('brand.engine', { ns: 'common' })} v{ENGINE_VERSION}
                </span>
              )}
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
