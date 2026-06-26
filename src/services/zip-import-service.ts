import { exists, mkdir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { dirname, join } from '@tauri-apps/api/path';
import { readZip } from './_zip-utils';

export interface ZipValidationResult {
  valid: boolean;
  projectJson?: Record<string, unknown>;
  error?: string;
}

export async function validateProjectZip(zipPath: string): Promise<ZipValidationResult> {
  try {
    const raw = Buffer.from(await readFile(zipPath));
    const entries = readZip(raw);
    const projectEntry = entries.find((e) => e.name === 'project.json' || e.name.endsWith('/project.json'));
    if (!projectEntry) return { valid: false, error: 'No project.json found in ZIP' };

    const parsed = JSON.parse(projectEntry.data.toString('utf-8')) as Record<string, unknown>;
    if (!parsed.id || !parsed.title) return { valid: false, error: 'project.json missing id or title' };

    return { valid: true, projectJson: parsed };
  } catch {
    // AP-006 exception: filesystem/ZIP read at import boundary — return structured error
    return { valid: false, error: 'Could not read or parse ZIP file' };
  }
}

function titleToSlug(title: string): string {
  return String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function resolveDestPath(baseDir: string, slug: string): Promise<string> {
  let dest = await join(baseDir, slug);
  let counter = 1;
  while (await exists(dest)) {
    dest = await join(baseDir, `${slug}-${counter}`);
    counter++;
  }
  return dest;
}

export async function importProjectZip(opts: {
  zipPath: string;
  baseDir?: string;
  conflictStrategy?: 'overwrite' | 'keep-both';
}): Promise<{ id: string; path: string }> {
  const validation = await validateProjectZip(opts.zipPath);
  if (!validation.valid || !validation.projectJson) {
    throw new Error(validation.error ?? 'Invalid ZIP');
  }

  const projectJson = validation.projectJson;
  const id = String(projectJson.id);
  const title = String(projectJson.title);
  const baseDir = opts.baseDir ?? 'projects';
  const slug = titleToSlug(title);

  const destPath = opts.conflictStrategy === 'keep-both'
    ? await resolveDestPath(baseDir, slug)
    : await join(baseDir, slug);

  const raw = Buffer.from(await readFile(opts.zipPath));
  const entries = readZip(raw);

  for (const entry of entries) {
    const filePath = await join(destPath, entry.name);
    await mkdir(await dirname(filePath), { recursive: true });
    await writeFile(filePath, entry.data);
  }

  return { id, path: destPath };
}
