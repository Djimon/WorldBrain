// pre-release S4 (#406): user data lives in a visible, user-writable place a normal
// (non-admin) Windows user finds in Explorer — `Documents\WorldsAndBeyond\` — NOT the
// read-only install folder (Program Files, UAC-locked) and NOT the hidden %AppData%.
// Epic decision D7. (The issue text says "WorldBuilderX"; the binding brand/Epic value
// is "WorldsAndBeyond" — user-facing rename.) The app creates + seeds these dirs at
// first run. app-config.json stays in appDataDir (app config, not user content).
import { documentDir, resourceDir, join } from '@tauri-apps/api/path';
import { copyFile, exists, mkdir } from '@tauri-apps/plugin-fs';

export const USER_DATA_ROOT = 'WorldsAndBeyond';
export const PROJECTS_SUBDIR = 'projects';
export const PLUGINS_SUBDIR = 'plugins';
export const THEMES_SUBDIR = 'themes';
export const THEME_TESTER_FILE = 'theme-tester.html';

/** `Documents\WorldsAndBeyond\`. Throws in a non-Tauri env (no documentDir). */
export async function userDataDir(): Promise<string> {
  return join(await documentDir(), USER_DATA_ROOT);
}

export async function userProjectsDir(): Promise<string> {
  return join(await userDataDir(), PROJECTS_SUBDIR);
}

export async function userThemesDir(): Promise<string> {
  return join(await userDataDir(), THEMES_SUBDIR);
}

/**
 * First-run bootstrap: idempotently create the user-visible data dirs and best-effort
 * seed theme-tester.html into `themes\`. Safe in a non-Tauri env (returns silently).
 * The theme-tester resource is bundled by S6 (#408); until then the seed is skipped.
 */
export async function ensureUserDataDirs(): Promise<void> {
  let base: string;
  try {
    base = await userDataDir();
  } catch {
    return; // no Tauri / no documentDir (tests, browser) → nothing to create
  }
  for (const sub of [PROJECTS_SUBDIR, PLUGINS_SUBDIR, THEMES_SUBDIR]) {
    const dir = await join(base, sub);
    if (!(await exists(dir))) {
      await mkdir(dir, { recursive: true });
    }
  }
  await seedThemeTester(await join(base, THEMES_SUBDIR));
}

/** Copy the bundled theme-tester.html into the user's themes dir (idempotent). */
async function seedThemeTester(themesDir: string): Promise<void> {
  const dest = await join(themesDir, THEME_TESTER_FILE);
  if (await exists(dest)) return; // never overwrite a user copy
  try {
    const src = await join(await resourceDir(), THEME_TESTER_FILE);
    if (await exists(src)) {
      await copyFile(src, dest);
    }
  } catch {
    // resource not bundled yet (pre-S6) or non-Tauri / no resource-read capability →
    // skip the seed; the dirs still exist so the user can drop the tool in manually.
  }
}
