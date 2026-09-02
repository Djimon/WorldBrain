// Filesystem-driven project discovery. The folder is the SINGLE source of truth for what
// projects exist: they are found by scanning <data_dir>\projects, not from a persisted list.
// This lets a user drop a foreign project folder into the projects dir and have the app pick
// it up, and it makes registry/folder divergence structurally impossible (there is no registry).
import { exists, readDir, readTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { userProjectsDir } from './user-data-dir';
import type { ProjectEntry } from './app-config-service';

/**
 * Read every project directly from the projects folder: one entry per subfolder that
 * holds a readable `project.json` with an `id`. The `path` is the real on-disk location.
 * Safe in a non-Tauri env (returns []).
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

/** Find a single project by id via a folder scan; null if it no longer exists. */
export async function findProjectById(id: string, projectsDir?: string): Promise<ProjectEntry | null> {
  const projects = await scanProjects(projectsDir);
  return projects.find((p) => p.id === id) ?? null;
}
