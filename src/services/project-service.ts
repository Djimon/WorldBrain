import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

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

export function createProject(opts: {
  title: string;
  description?: string;
  baseDir?: string;
}): { id: string; path: string } {
  const baseDir = opts.baseDir ?? 'projects';
  const slug = titleToSlug(opts.title);
  const projectPath = join(baseDir, slug);

  if (existsSync(projectPath)) {
    throw new Error(`Folder already exists: ${projectPath}`);
  }

  const id = `proj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  for (const sub of ['entities', 'maps', 'sessions', 'assets', 'plugins']) {
    mkdirSync(join(projectPath, sub), { recursive: true });
  }

  const meta: ProjectMeta = {
    id,
    title: opts.title,
    schema_version: '1.0.0',
    created_at: now,
    updated_at: now,
    ...(opts.description ? { description: opts.description } : {}),
  };

  writeFileSync(join(projectPath, 'project.json'), JSON.stringify(meta, null, 2), 'utf-8');

  return { id, path: projectPath };
}
