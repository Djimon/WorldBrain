import { exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { appDataDir, join } from '@tauri-apps/api/path';

export interface ProjectMeta {
  id: string;
  title: string;
  schema_version: string;
  created_at: string;
  updated_at: string;
  description?: string;
}

export function titleToSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function createProject(opts: {
  title: string;
  description?: string;
  baseDir?: string;
}): Promise<{ id: string; path: string }> {
  const baseDir = opts.baseDir ?? await join(await appDataDir(), 'projects');
  const slug = titleToSlug(opts.title);
  const projectPath = await join(baseDir, slug);

  if (await exists(projectPath)) {
    throw new Error(`Folder already exists: ${projectPath}`);
  }

  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  for (const sub of ['entities', 'maps', 'sessions', 'assets', 'plugins']) {
    await mkdir(await join(projectPath, sub), { recursive: true });
  }

  const meta: ProjectMeta = {
    id,
    title: opts.title,
    schema_version: '1.0.0',
    created_at: now,
    updated_at: now,
    ...(opts.description ? { description: opts.description } : {}),
  };

  await writeTextFile(await join(projectPath, 'project.json'), JSON.stringify(meta, null, 2));

  return { id, path: projectPath };
}

/** Read a project's `project.json` metadata; null if absent/unreadable (non-Tauri, test). */
export async function readProjectMeta(projectDir: string): Promise<ProjectMeta | null> {
  try {
    return JSON.parse(await readTextFile(await join(projectDir, 'project.json'))) as ProjectMeta;
  } catch {
    return null;
  }
}

/**
 * Update title/description in a project's `project.json` (bumps `updated_at`).
 * The on-disk folder keeps its original creation slug — only the metadata changes,
 * so no folder rename is needed. A blank description clears the key.
 */
export async function updateProjectMeta(
  projectDir: string,
  patch: { title?: string; description?: string },
): Promise<ProjectMeta> {
  const metaPath = await join(projectDir, 'project.json');
  const meta = JSON.parse(await readTextFile(metaPath)) as ProjectMeta;
  const next: ProjectMeta = {
    ...meta,
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    updated_at: new Date().toISOString(),
  };
  if (patch.description !== undefined) {
    const trimmed = patch.description.trim();
    if (trimmed) next.description = trimmed;
    else delete next.description;
  }
  await writeTextFile(metaPath, JSON.stringify(next, null, 2));
  return next;
}
