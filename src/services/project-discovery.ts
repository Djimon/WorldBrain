// pre-release follow-up: filesystem-driven project discovery. The registry
// (app-config.json → projects[]) is a cache, NOT the source of truth for what exists —
// the folder is. This lets a user drop a foreign project folder into <data_dir>\projects
// and have the app pick it up on start (and heals paths after the data folder moves).
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { userProjectsDir } from './user-data-dir';
import { readAppConfig, writeAppConfig } from './app-config-service';
import type { AppConfig, ProjectEntry } from './app-config-service';

/**
 * Read every project directly from the projects folder: one entry per subfolder that
 * holds a readable `project.json` with an `id`. The `path` is the real on-disk location,
 * so the result always reflects where the project ACTUALLY is. Safe in a non-Tauri env
 * (returns []).
 */
export async function scanProjects(projectsDir?: string): Promise<ProjectEntry[]> {
  let base: string;
  try {
    base = projectsDir ?? await userProjectsDir();
  } catch {
    return []; // no Tauri / no data dir
  }
  if (!(await exists(base))) return [];
  let entries: { name: string; isDirectory: boolean }[];
  try {
    entries = await readDir(base);
  } catch {
    return [];
  }
  const out: ProjectEntry[] = [];
  for (const dirent of entries) {
    if (!dirent.isDirectory) continue;
    const dir = await join(base, dirent.name);
    const metaPath = await join(dir, 'project.json');
    if (!(await exists(metaPath))) continue;
    try {
      const meta = JSON.parse(await readTextFile(metaPath)) as { id?: string; title?: string };
      if (meta.id) out.push({ id: meta.id, title: meta.title ?? dirent.name, path: dir });
    } catch {
      // unreadable / invalid project.json → skip this folder
    }
  }
  return out;
}

/**
 * Reconcile the registry with what is actually on disk and persist the result:
 * - the folder scan wins (adds newly dropped-in projects, heals paths after a move),
 * - registry entries whose folder still exists are kept (covers projects outside data_dir),
 * - entries whose folder is verifiably gone and are not rediscovered are pruned.
 * `last_opened_project_id` is left untouched — if it now points nowhere, the welcome screen
 * already shows its "last project missing" hint. Only writes when something actually changed.
 * Best-effort in a non-Tauri env (returns the config unchanged if the scan/write is unavailable).
 */
export async function reconcileProjects(configPath?: string, projectsDir?: string): Promise<AppConfig> {
  const cfg = await readAppConfig(configPath);
  const scanned = await scanProjects(projectsDir);

  const byId = new Map<string, ProjectEntry>();
  // 1. keep registry entries whose folder is still there (covers custom locations). Only
  //    prune when exists() can POSITIVELY say the folder is gone — if the check itself is
  //    unavailable (non-Tauri), keep the entry rather than wrongly dropping it.
  for (const p of cfg.projects) {
    let present = true;
    try {
      present = await exists(p.path);
    } catch {
      present = true; // can't determine → keep
    }
    if (present) byId.set(p.id, p);
  }
  // 2. the scan wins — fresh path heals moves, and brand-new folders get added
  for (const s of scanned) byId.set(s.id, s);

  const projects = [...byId.values()];
  const next: AppConfig = { ...cfg, projects };

  if (JSON.stringify(next) !== JSON.stringify(cfg)) {
    try {
      await writeAppConfig(next, configPath);
    } catch {
      // not writable → return the reconciled view anyway; callers still get the right list
    }
  }
  return next;
}
