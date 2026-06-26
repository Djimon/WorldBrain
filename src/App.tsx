import { useEffect, useState } from 'react';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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
  const dbPath = join(projectEntry.path, 'world.db');
  const db = await openProjectDb(dbPath);
  scanPlugins(join(projectEntry.path, 'plugins'));
  return { kind: 'workspace', projectId: projectEntry.id, projectDir: projectEntry.path, db };
}

function findProjectPath(projectId: string, baseDir: string): string | null {
  if (!existsSync(baseDir)) return null;
  for (const dirent of readdirSync(baseDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const metaPath = join(baseDir, dirent.name, 'project.json');
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as { id?: string; title?: string };
      if (meta.id === projectId) return join(baseDir, dirent.name);
    } catch { /* skip */ }
  }
  return null;
}

export function App() {
  const [mode, setMode] = useState<AppMode>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    try {
      const config = readAppConfig(APP_CONFIG_PATH);
      if (config.last_opened_project_id) {
        const entry = config.projects.find((p) => p.id === config.last_opened_project_id);
        if (entry) {
          initWorkspace(entry).then((workspace) => {
            if (!cancelled) setMode(workspace);
          }).catch(() => {
            if (!cancelled) setMode({ kind: 'welcome' });
          });
          return () => { cancelled = true; };
        }
      }
    } catch { /* AP-006 exception: config read at startup boundary */ }
    setMode({ kind: 'welcome' });
    return () => { cancelled = true; };
  }, []);

  function openProject(projectId: string) {
    const config = readAppConfig(APP_CONFIG_PATH);
    const entry = config.projects.find((p) => p.id === projectId);
    if (!entry) return;
    setMode({ kind: 'loading' });
    initWorkspace(entry).then(setMode).catch(() => setMode({ kind: 'welcome' }));
  }

  function closeProject() {
    setMode({ kind: 'welcome' });
  }

  function handleProjectCreated(projectId: string) {
    const projectPath = findProjectPath(projectId, PROJECTS_BASE_DIR);
    if (!projectPath) return;
    const meta = JSON.parse(readFileSync(join(projectPath, 'project.json'), 'utf-8')) as { title: string };
    registerProject(APP_CONFIG_PATH, { id: projectId, title: meta.title, path: projectPath });
    setMode({ kind: 'loading' });
    openProjectDb(join(projectPath, 'world.db')).then((db) => {
      setMode({ kind: 'workspace', projectId, projectDir: projectPath, db });
    }).catch(() => setMode({ kind: 'welcome' }));
  }

  function handleZipImported(projectId: string) {
    const projectPath = findProjectPath(projectId, PROJECTS_BASE_DIR);
    if (!projectPath) return;
    const meta = JSON.parse(readFileSync(join(projectPath, 'project.json'), 'utf-8')) as { title: string };
    registerProject(APP_CONFIG_PATH, { id: projectId, title: meta.title, path: projectPath });
    setMode({ kind: 'loading' });
    openProjectDb(join(projectPath, 'world.db')).then((db) => {
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
  const snapshotsDir = join(projectDir, 'snapshots');

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
