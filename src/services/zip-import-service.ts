import * as fs from 'node:fs';
import { dirname, join } from 'node:path';
import { readZip } from './_zip-utils';

export interface ZipValidationResult {
  valid: boolean;
  projectJson?: Record<string, unknown>;
  error?: string;
}

function readBinaryFile(filePath: string): Buffer {
  return Buffer.from(fs.readFileSync(filePath, 'binary'), 'binary');
}

export function validateProjectZip(zipPath: string): ZipValidationResult {
  try {
    const raw = readBinaryFile(zipPath);
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

function resolveDestPath(baseDir: string, slug: string): string {
  let dest = join(baseDir, slug);
  let counter = 1;
  while (fs.existsSync(dest)) {
    dest = join(baseDir, `${slug}-${counter}`);
    counter++;
  }
  return dest;
}

export function importProjectZip(opts: {
  zipPath: string;
  baseDir?: string;
  conflictStrategy?: 'overwrite' | 'keep-both';
}): { id: string; path: string } {
  const validation = validateProjectZip(opts.zipPath);
  if (!validation.valid || !validation.projectJson) {
    throw new Error(validation.error ?? 'Invalid ZIP');
  }

  const projectJson = validation.projectJson;
  const id = String(projectJson.id);
  const title = String(projectJson.title);
  const baseDir = opts.baseDir ?? 'projects';
  const slug = titleToSlug(title);

  const destPath = opts.conflictStrategy === 'keep-both'
    ? resolveDestPath(baseDir, slug)
    : join(baseDir, slug);

  const raw = readBinaryFile(opts.zipPath);
  const entries = readZip(raw);

  for (const entry of entries) {
    const filePath = join(destPath, entry.name);
    fs.mkdirSync(dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, entry.data);
  }

  return { id, path: destPath };
}
