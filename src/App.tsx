import { useEffect, useState } from 'react';
import { join } from '@tauri-apps/api/path';
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

const APP_CONFIG_PATH = 'app-config.json';
const PROJECTS_BASE_DIR = 'projects';

type AppMode =
  | { kind: 'welcome' }
  | { kind: 'loading' }
  | { kind: 'new-project' }
  | { kind: 'import-zip' }
  | { kind: 'workspace'; projectId: string; projectDir: string; db: DatabaseLike };

async function initWorkspace(projectEntry: ProjectEntry): Promise<AppMode & { kind: 'workspace' }> {
  const dbPath = await join(projectEntry.path, 'world.db');
  const db = await openProjectDb(dbPath);
  await scanPlugins(await join(projectEntry.path, 'plugins'));
  return { kind: 'workspace', projectId: projectEntry.id, projectDir: projectEntry.path, db };
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

  useEffect(() => {
    let cancelled = false;
    readAppConfig(APP_CONFIG_PATH).then(async (config) => {
      if (cancelled) return;
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
      if (!cancelled) setMode({ kind: 'welcome' });
    }).catch(() => {
      if (!cancelled) setMode({ kind: 'welcome' });
    });
    return () => { cancelled = true; };
  }, []);

  function openProject(projectId: string) {
    setMode({ kind: 'loading' });
    readAppConfig(APP_CONFIG_PATH).then(async (config) => {
      const entry = config.projects.find((p) => p.id === projectId);
      if (!entry) { setMode({ kind: 'welcome' }); return; }
      try {
        setMode(await initWorkspace(entry));
      } catch {
        setMode({ kind: 'welcome' });
      }
    }).catch(() => setMode({ kind: 'welcome' }));
  }

  function closeProject() {
    setMode({ kind: 'welcome' });
  }

  function handleProjectCreated(projectId: string) {
    setMode({ kind: 'loading' });
    findProjectPath(projectId, PROJECTS_BASE_DIR).then(async (projectPath) => {
      if (!projectPath) { setMode({ kind: 'welcome' }); return; }
      const metaPath = await join(projectPath, 'project.json');
      const meta = JSON.parse(await readTextFile(metaPath)) as { title: string };
      await registerProject(APP_CONFIG_PATH, { id: projectId, title: meta.title, path: projectPath });
      const db = await openProjectDb(await join(projectPath, 'world.db'));
      setMode({ kind: 'workspace', projectId, projectDir: projectPath, db });
    }).catch(() => setMode({ kind: 'welcome' }));
  }

  function handleZipImported(projectId: string) {
    setMode({ kind: 'loading' });
    findProjectPath(projectId, PROJECTS_BASE_DIR).then(async (projectPath) => {
      if (!projectPath) { setMode({ kind: 'welcome' }); return; }
      const metaPath = await join(projectPath, 'project.json');
      const meta = JSON.parse(await readTextFile(metaPath)) as { title: string };
      await registerProject(APP_CONFIG_PATH, { id: projectId, title: meta.title, path: projectPath });
      const db = await openProjectDb(await join(projectPath, 'world.db'));
      setMode({ kind: 'workspace', projectId, projectDir: projectPath, db });
    }).catch(() => setMode({ kind: 'welcome' }));
  }

  if (mode.kind === 'loading') {
    return <div style={{ padding: '2rem' }}>Laden…</div>;
  }

  if (mode.kind === 'welcome') {
    return (
      <WelcomeScreen
        configPath={APP_CONFIG_PATH}
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
  const { projectId, projectDir, db } = mode;
  const snapshotsDir = `${projectDir}/snapshots`;

  return (
    <DatabaseProvider value={db}>
      <WorkspaceShell
        projectId={projectId}
        projectDir={projectDir}
        snapshotsDir={snapshotsDir}
        onProjectClose={closeProject}
      />
    </DatabaseProvider>
  );
}
