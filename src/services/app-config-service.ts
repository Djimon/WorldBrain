import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export interface ProjectEntry {
  id: string;
  title: string;
  path: string;
}

export interface AppConfig {
  last_opened_project_id: string | null;
  projects: ProjectEntry[];
}

const DEFAULT_CONFIG: AppConfig = { last_opened_project_id: null, projects: [] };

export async function readAppConfig(configPath: string): Promise<AppConfig> {
  try {
    const raw = await readTextFile(configPath);
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      last_opened_project_id: parsed.last_opened_project_id ?? null,
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
    };
  } catch {
    // AP-006 exception: filesystem read at app startup boundary — return safe default
    return { ...DEFAULT_CONFIG, projects: [] };
  }
}

export async function writeAppConfig(configPath: string, config: AppConfig): Promise<void> {
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
}

export async function registerProject(configPath: string, project: ProjectEntry): Promise<void> {
  const config = await readAppConfig(configPath);
  const idx = config.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    config.projects[idx] = project;
  } else {
    config.projects.push(project);
  }
  await writeAppConfig(configPath, config);
}

export async function unregisterProject(configPath: string, projectId: string): Promise<void> {
  const config = await readAppConfig(configPath);
  config.projects = config.projects.filter((p) => p.id !== projectId);
  if (config.last_opened_project_id === projectId) {
    config.last_opened_project_id = null;
  }
  await writeAppConfig(configPath, config);
}
