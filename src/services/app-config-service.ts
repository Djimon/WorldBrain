import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

/** A project as it lives on disk. Discovered by scanning <data_dir>\projects (see
 *  project-discovery.ts) — the folder is the single source of truth, so this is NOT
 *  persisted as a list in the config anymore. */
export interface ProjectEntry {
  id: string;
  title: string;
  path: string;
}

export interface AppConfig {
  /** The project to reopen on next launch (id only — its folder is found by scanning). */
  last_opened_project_id: string | null;
  /** Absolute path to the user data root (projects/themes/plugins/help). When null,
   *  the platform default (Documents\WorldsAndBeyond) applies — see user-data-dir.ts.
   *  This is the ONE source of truth for the data location. */
  data_dir: string | null;
}

const DEFAULT_CONFIG: AppConfig = { last_opened_project_id: null, data_dir: null };
const DEFAULT_CONFIG_PATH = 'app-config.json';

export async function readAppConfig(configPath = DEFAULT_CONFIG_PATH): Promise<AppConfig> {
  try {
    const raw = await readTextFile(configPath);
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return {
      last_opened_project_id: parsed.last_opened_project_id ?? null,
      data_dir: typeof parsed.data_dir === 'string' ? parsed.data_dir : null,
    };
  } catch {
    // AP-006 exception: filesystem read at app startup boundary — return safe default
    return { ...DEFAULT_CONFIG };
  }
}

export async function writeAppConfig(config: AppConfig, configPath = DEFAULT_CONFIG_PATH): Promise<void> {
  await writeTextFile(configPath, JSON.stringify(config, null, 2));
}
