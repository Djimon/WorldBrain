import { exists, mkdir, writeTextFile } from '@tauri-apps/plugin-fs';
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
