import { useEffect, useRef, useState } from 'react';
import { appDataDir, join } from '@tauri-apps/api/path';
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import type { DatabaseLike } from './services/entity-service';
import { readAppConfig, registerProject } from './services/app-config-service';
import type { ProjectEntry } from './services/app-config-service';
import { openProjectDb } from './services/db-init';
import { scanPlugins } from './services/plugin-loader';
import { DatabaseProvider } from './services/DatabaseContext';
import { WelcomeScreen } from './ui/WelcomeScreen';
import { NewProjectDialog } from './ui/NewProjectDialog';
import { ZipImportDialog } from './ui/ZipImportDialog';
import { WorkspaceShell } from './ui/WorkspaceShell';
import './style.css';
import './tab-wiring';

const APP_CONFIG_FILENAME = 'app-config.json';
const PROJECTS_SUBDIR = 'projects';

type AppMode =
  | { kind: 'welcome' }
  | { kind: 'loading' }
  | { kind: 'new-project' }
  | { kind: 'import-zip' }
  | { kind: 'workspace'; projectId: string; projectTitle: string; projectDir: string; db: DatabaseLike };

async function initWorkspace(projectEntry: ProjectEntry): Promise<AppMode & { kind: 'workspace' }> {
  const dbPath = await join(projectEntry.path, 'world.db');
  const db = await openProjectDb(dbPath);
  await scanPlugins(await join(projectEntry.path, 'plugins'));
  return { kind: 'workspace', projectId: projectEntry.id, projectTitle: projectEntry.title, projectDir: projectEntry.path, db };
}

async function findProjectPath(projectId: string, baseDir: string): Promise<string | null> {
  if (!(await exists(baseDir))) return null;
  for (const dirent of await readDir(baseDir)) {
    if (!dirent.isDirectory) continue;
    const metaPath = await join(baseDir, dirent.name, 'project.json');
    if (!(await exists(metaPath))) continue;
    try {
      const meta = JSON.parse(await readTextFile(metaPath)) as { id?: string; title?: string };
      if (meta.id === projectId) return await join(baseDir, dirent.name);
    } catch { /* skip */ }
  }
  return null;
}

export function App() {
  const [mode, setMode] = useState<AppMode>({ kind: 'loading' });
  const appBase = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    appDataDir().then(async (base) => {
      if (cancelled) return;
      appBase.current = base;
      const configPath = await join(base, APP_CONFIG_FILENAME);
      const projectsBase = await join(base, PROJECTS_SUBDIR);
      const config = await readAppConfig(configPath);
      if (config.last_opened_project_id) {
        const entry = config.projects.find((p) => p.id === config.last_opened_project_id);
        if (entry) {
          try {
            const workspace = await initWorkspace(entry);
            if (!cancelled) setMode(workspace);
            return;
          } catch { /* fall through to welcome */ }
        }
      }
      void projectsBase; // resolved but only needed later
      if (!cancelled) setMode({ kind: 'welcome' });
    }).catch(() => {
      if (!cancelled) setMode({ kind: 'welcome' });
    });
    return () => { cancelled = true; };
  }, []);

  function openProject(projectId: string) {
    setMode({ kind: 'loading' });
    join(appBase.current, APP_CONFIG_FILENAME).then(async (configPath) => {
      const config = await readAppConfig(configPath);
      const entry = config.projects.find((p) => p.id === projectId);
      if (!entry) { setMode({ kind: 'welcome' }); return; }
      setMode(await initWorkspace(entry));
    }).catch((e: unknown) => { console.error('[openProject]', e); setMode({ kind: 'welcome' }); });
  }

  function closeProject() {
    setMode({ kind: 'welcome' });
  }

  function handleProjectCreated(projectId: string) {
    setMode({ kind: 'loading' });
    join(appBase.current, PROJECTS_SUBDIR).then(async (projectsBase) => {
      const projectPath = await findProjectPath(projectId, projectsBase);
      if (!projectPath) { setMode({ kind: 'welcome' }); return; }
      const metaPath = await join(projectPath, 'project.json');
      const meta = JSON.parse(await readTextFile(metaPath)) as { title: string };
      const configPath = await join(appBase.current, APP_CONFIG_FILENAME);
      await registerProject({ id: projectId, title: meta.title, path: projectPath }, configPath);
      const db = await openProjectDb(await join(projectPath, 'world.db'));
      setMode({ kind: 'workspace', projectId, projectTitle: meta.title, projectDir: projectPath, db });
    }).catch((e: unknown) => { console.error('[handleProjectCreated]', e); setMode({ kind: 'welcome' }); });
  }

  function handleZipImported(projectId: string) {
    setMode({ kind: 'loading' });
    join(appBase.current, PROJECTS_SUBDIR).then(async (projectsBase) => {
      const projectPath = await findProjectPath(projectId, projectsBase);
      if (!projectPath) { setMode({ kind: 'welcome' }); return; }
      const metaPath = await join(projectPath, 'project.json');
      const meta = JSON.parse(await readTextFile(metaPath)) as { title: string };
      const configPath = await join(appBase.current, APP_CONFIG_FILENAME);
      await registerProject({ id: projectId, title: meta.title, path: projectPath }, configPath);
      const db = await openProjectDb(await join(projectPath, 'world.db'));
      setMode({ kind: 'workspace', projectId, projectTitle: meta.title, projectDir: projectPath, db });
    }).catch(() => setMode({ kind: 'welcome' }));
  }

  if (mode.kind === 'loading') {
    return <div style={{ padding: '2rem' }}>Laden…</div>;
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
        onCreated={handleProjectCreated}
        onCancel={() => setMode({ kind: 'welcome' })}
        baseDir={appBase ? `${appBase}/${PROJECTS_SUBDIR}` : undefined}
      />
    );
  }

  if (mode.kind === 'import-zip') {
    return (
      <ZipImportDialog
        onImported={handleZipImported}
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
      />
    </DatabaseProvider>
  );
}
