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
 * - entries whose folder is verifiably gone and are not rediscovered are pruned,
 * - each id AND each folder path appears at most once (the scan's project.json is the truth,
 *   so a stale entry pointing at a folder the scan claims for another id is dropped).
 * `last_opened_project_id` is left untouched — if it now points nowhere, the welcome screen
 * already shows its "last project missing" hint. Only writes when something actually changed.
 * Best-effort in a non-Tauri env (returns the config unchanged if the scan/write is unavailable).
 */
function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

export async function reconcileProjects(configPath?: string, projectsDir?: string): Promise<AppConfig> {
  const cfg = await readAppConfig(configPath);
  const scanned = await scanProjects(projectsDir);

  const projects: ProjectEntry[] = [];
  const seenIds = new Set<string>();
  const seenPaths = new Set<string>();
  const claim = (e: ProjectEntry): void => {
    projects.push(e);
    seenIds.add(e.id);
    seenPaths.add(normalizePath(e.path));
  };

  // 1. the scan is authoritative for its folders — a project.json defines who owns a path.
  //    (data_dir\projects can't contain duplicate folder names, so paths here are unique.)
  for (const s of scanned) {
    if (seenIds.has(s.id)) continue;
    claim(s);
  }
  // 2. keep registry entries that add a NEW id AND a NEW path and whose folder still exists.
  //    This covers projects outside data_dir, while never producing a second entry for a
  //    path the scan already claimed (that stale entry is dropped) and never a duplicate id.
  for (const p of cfg.projects) {
    if (seenIds.has(p.id) || seenPaths.has(normalizePath(p.path))) continue;
    let present = true;
    try {
      present = await exists(p.path);
    } catch {
      present = true; // can't determine (non-Tauri) → keep rather than wrongly drop
    }
    if (present) claim(p);
  }

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
