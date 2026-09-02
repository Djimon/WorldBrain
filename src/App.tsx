import { useEffect, useRef, useState } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';
import type { DatabaseLike } from './services/entity-service';
import { readAppConfig, writeAppConfig } from './services/app-config-service';
import type { ProjectEntry } from './services/app-config-service';
import { findProjectById } from './services/project-discovery';
import { openProjectDb } from './services/db-init';
import { scanPlugins } from './services/plugin-loader';
import { loadPluginEntityTypes } from './services/plugin-schema-loader';
import { DatabaseProvider } from './services/DatabaseContext';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { NewProjectDialog } from './ui/NewProjectDialog';
import { ZipImportDialog } from './ui/ZipImportDialog';
import { WorkspaceShell } from './ui/WorkspaceShell';
import './styles/index.css';
import './tab-wiring';

const APP_CONFIG_FILENAME = 'app-config.json';

type AppMode =
  | { kind: 'welcome' }
  | { kind: 'loading' }
  | { kind: 'new-project' }
  | { kind: 'import-zip' }
  | { kind: 'workspace'; projectId: string; projectTitle: string; projectDir: string; db: DatabaseLike };

async function initWorkspace(projectEntry: ProjectEntry): Promise<AppMode & { kind: 'workspace' }> {
  const dbPath = await join(projectEntry.path, 'world.db');
  const db = await openProjectDb(dbPath);
  const pluginsDir = await join(projectEntry.path, 'plugins');
  const registry = await scanPlugins(pluginsDir);
  // #225: loadPluginEntityTypes (M9-S08) was previously never called from
  // production code — a system plugin's entity_types/tables never actually
  // materialized outside of tests. Wire it in for every loaded system plugin.
  for (const [folder, entry] of Object.entries(registry)) {
    if (entry.status === 'loaded' && entry.manifest.system === true) {
      const pluginDir = await join(pluginsDir, folder);
      await loadPluginEntityTypes({ database: db, pluginDir, manifest: entry.manifest });
    }
  }
  return { kind: 'workspace', projectId: projectEntry.id, projectTitle: projectEntry.title, projectDir: projectEntry.path, db };
}

export function App() {
  const [mode, setMode] = useState<AppMode>({ kind: 'loading' });
  const appBase = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    appDataDir().then(async (base) => {
      if (cancelled) return;
      appBase.current = base;
      // #393: user themes are now registered in the shared bootstrap (main.tsx →
      // bootstrapUserThemes) for EVERY window — no longer needed here.
      const configPath = await join(base, APP_CONFIG_FILENAME);
      const config = await readAppConfig(configPath);
      // Discovery is filesystem-driven: the last-opened project is located by scanning
      // <data_dir>\projects for its id (no persisted project list).
      if (config.last_opened_project_id) {
        const entry = await findProjectById(config.last_opened_project_id);
        if (entry) {
          try {
            const workspace = await initWorkspace(entry);
            if (!cancelled) setMode(workspace);
            return;
          } catch { /* fall through to welcome */ }
        }
      }
      if (!cancelled) setMode({ kind: 'welcome' });
    }).catch(() => {
      if (!cancelled) setMode({ kind: 'welcome' });
    });
    return () => { cancelled = true; };
  }, []);

  function openProject(projectId: string) {
    setMode({ kind: 'loading' });
    findProjectById(projectId).then(async (entry) => {
      if (!entry) { setMode({ kind: 'welcome' }); return; }
      setMode(await initWorkspace(entry));
    }).catch((e: unknown) => { console.error('[openProject]', e); setMode({ kind: 'welcome' }); });
  }

  function closeProject() {
    setMode({ kind: 'welcome' });
  }

  // A freshly created or imported project already lives on disk (folder + project.json),
  // so it is discovered by id via a scan — no registry write. The workspace-mode effect
  // below persists last_opened_project_id.
  function openFreshProject(projectId: string) {
    setMode({ kind: 'loading' });
    findProjectById(projectId).then(async (entry) => {
      if (!entry) { setMode({ kind: 'welcome' }); return; }
      setMode(await initWorkspace(entry));
    }).catch((e: unknown) => { console.error('[openFreshProject]', e); setMode({ kind: 'welcome' }); });
  }

  // Remember the last opened project so the next launch reopens it directly,
  // instead of always dropping to the welcome screen.
  useEffect(() => {
    if (mode.kind !== 'workspace') return;
    const id = mode.projectId;
    void join(appBase.current, APP_CONFIG_FILENAME).then(async (configPath) => {
      const config = await readAppConfig(configPath);
      if (config.last_opened_project_id === id) return;
      await writeAppConfig({ ...config, last_opened_project_id: id }, configPath);
    }).catch(() => { /* best effort — remembering the project is non-critical */ });
  }, [mode]);

  if (mode.kind === 'loading') {
    return <div className="app-loading">Laden…</div>;
  }

  if (mode.kind === 'welcome') {
    return (
      <WelcomeScreen
        configPath={`${appBase.current}/${APP_CONFIG_FILENAME}`}
        onCreateProject={() => setMode({ kind: 'new-project' })}
        onImportZip={() => setMode({ kind: 'import-zip' })}
        onOpenProject={openProject}
      />
    );
  }

  if (mode.kind === 'new-project') {
    return (
      <NewProjectDialog
        onCreated={openFreshProject}
        onCancel={() => setMode({ kind: 'welcome' })}
      />
    );
  }

  if (mode.kind === 'import-zip') {
    return (
      <ZipImportDialog
        onImported={openFreshProject}
        onCancel={() => setMode({ kind: 'welcome' })}
      />
    );
  }

  // mode.kind === 'workspace'
  const { projectId, projectTitle, projectDir, db } = mode;
  const snapshotsDir = `${projectDir}/snapshots`;

  return (
    <DatabaseProvider value={db}>
      <WorkspaceShell
        projectId={projectId}
        projectTitle={projectTitle}
        projectDir={projectDir}
        snapshotsDir={snapshotsDir}
        onProjectClose={closeProject}
        onOpenProject={openProject}
      />
    </DatabaseProvider>
  );
}
