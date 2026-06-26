import { readFileSync, writeFileSync } from 'node:fs';

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

export function readAppConfig(configPath: string): AppConfig {
  try {
    const raw = readFileSync(configPath, 'utf-8');
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

export function writeAppConfig(configPath: string, config: AppConfig): void {
  writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function registerProject(configPath: string, project: ProjectEntry): void {
  const config = readAppConfig(configPath);
  const idx = config.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    config.projects[idx] = project;
  } else {
    config.projects.push(project);
  }
  writeAppConfig(configPath, config);
}

export function unregisterProject(configPath: string, projectId: string): void {
  const config = readAppConfig(configPath);
  config.projects = config.projects.filter((p) => p.id !== projectId);
  if (config.last_opened_project_id === projectId) {
    config.last_opened_project_id = null;
  }
  writeAppConfig(configPath, config);
}
