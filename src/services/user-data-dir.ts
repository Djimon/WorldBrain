// pre-release S4 (#406): user data lives in a visible, user-writable place a normal
// (non-admin) Windows user finds in Explorer — `Documents\WorldsAndBeyond\` — NOT the
// read-only install folder (Program Files, UAC-locked) and NOT the hidden %AppData%.
// Epic decision D7. (The issue text says "WorldBuilderX"; the binding brand/Epic value
// is "WorldsAndBeyond" — user-facing rename.) The app creates + seeds these dirs at
// first run. app-config.json stays in appDataDir (app config, not user content).
import { documentDir, appDataDir, resourceDir, join } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir } from '@tauri-apps/plugin-fs';
import { readAppConfig } from './app-config-service';

export const USER_DATA_ROOT = 'WorldsAndBeyond';
export const APP_CONFIG_FILE = 'app-config.json';
export const PROJECTS_SUBDIR = 'projects';
export const PLUGINS_SUBDIR = 'plugins';
export const THEMES_SUBDIR = 'themes';
export const HELP_SUBDIR = 'help';
export const THEME_TESTER_FILE = 'theme-tester.html';
// #408: user how-to shipped as bundle.resources, seeded into help\ so the user finds it.
export const HOWTO_FILES = ['user-guide_de.md', 'user-guide_en.md'];

/** Bootstrap location of the config file itself: `<appDataDir>\app-config.json`.
 *  This is fixed (chicken/egg — the config can't say where the config lives), and is
 *  the SAME path App.tsx / SettingsPanel read. Only the DATA dir inside it is variable. */
async function appConfigPath(): Promise<string> {
  return join(await appDataDir(), APP_CONFIG_FILE);
}

/** Platform default when the config does not pin a location: `Documents\WorldsAndBeyond\`.
 *  Throws in a non-Tauri env (no documentDir). */
export async function defaultUserDataDir(): Promise<string> {
  return join(await documentDir(), USER_DATA_ROOT);
}

/**
 * The user data root — the ONE source of truth for where projects/themes/plugins/help
 * live. An explicit `data_dir` in app-config.json wins; otherwise the platform default
 * (Documents\WorldsAndBeyond). Reading it from config means the displayed path and the
 * actually-used path never diverge. Falls back to the default in a non-Tauri env or when
 * no config exists yet (first run). Throws only if even the default can't be resolved.
 */
export async function userDataDir(): Promise<string> {
  try {
    const cfg = await readAppConfig(await appConfigPath());
    if (cfg.data_dir) return cfg.data_dir;
  } catch {
    // no Tauri / no config yet → platform default below
  }
  return defaultUserDataDir();
}

export async function userProjectsDir(): Promise<string> {
  return join(await userDataDir(), PROJECTS_SUBDIR);
}

export async function userThemesDir(): Promise<string> {
  return join(await userDataDir(), THEMES_SUBDIR);
}

/**
 * First-run bootstrap: idempotently create the user-visible data dirs and best-effort
 * seed the bundled resources (theme-tester.html → themes\, the how-to guides → help\).
 * Safe in a non-Tauri env (returns silently). Resources are bundled by S6 (#408);
 * without them (dev / missing capability) the seed is skipped, dirs still created.
 */
export async function ensureUserDataDirs(): Promise<void> {
  let base: string;
  try {
    base = await userDataDir();
  } catch {
    return; // no Tauri / no documentDir (tests, browser) → nothing to create
  }
  for (const sub of [PROJECTS_SUBDIR, PLUGINS_SUBDIR, THEMES_SUBDIR, HELP_SUBDIR]) {
    const dir = await join(base, sub);
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
  }
  await seedResource(THEME_TESTER_FILE, await join(base, THEMES_SUBDIR));
  for (const file of HOWTO_FILES) {
    await seedResource(file, await join(base, HELP_SUBDIR));
  }
}

/** Copy a bundled resource file into destDir (idempotent, best-effort). */
async function seedResource(fileName: string, destDir: string): Promise<void> {
  const dest = await join(destDir, fileName);
  if (await exists(dest)) return; // never overwrite a user copy
  try {
    const src = await join(await resourceDir(), fileName);
    if (await exists(src)) {
      await copyFile(src, dest);
    }
  } catch {
    // resource not bundled (dev) or non-Tauri / no resource-read capability →
    // skip; the dirs still exist so the user can drop files in manually.
  }
}
