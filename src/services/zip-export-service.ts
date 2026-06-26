// @tauri-apps/plugin-fs
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from './_fs';
import { join, relative } from './_path';
import { createZip } from './_zip-utils';
import { createSnapshot } from './snapshot-service';

export function buildZipFilename(title: string, date: Date = new Date()): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const dateStr = date.toISOString().slice(0, 10);
  return `${slug}-${dateStr}.zip`;
}

export function getZipExclusions(): string[] {
  return ['*.sqlite', '*.db', 'runtime.db', 'snapshots/'];
}

function isExcluded(relPath: string): boolean {
  const lower = relPath.toLowerCase().replace(/\\/g, '/');
  return (
    lower.endsWith('.sqlite') ||
    lower.endsWith('.db') ||
    lower.startsWith('snapshots/') ||
    lower.includes('/snapshots/')
  );
}

function collectFiles(dir: string, baseDir: string): Array<{ name: string; data: Buffer }> {
  const results: Array<{ name: string; data: Buffer }> = [];
  for (const dirent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, dirent.name);
    const rel = relative(baseDir, full).replace(/\\/g, '/');
    if (isExcluded(rel)) continue;
    if (dirent.isDirectory()) {
      results.push(...collectFiles(full, baseDir));
    } else {
      const data = Buffer.from(readFileSync(full, 'binary'), 'binary');
      results.push({ name: rel, data });
    }
  }
  return results;
}

export async function exportProjectToZip(opts: {
  projectId: string;
  projectDir?: string;
  projectPath?: string;
  outputPath: string;
  snapshotsDir?: string;
  title?: string;
}): Promise<void> {
  const projectDir = opts.projectDir ?? opts.projectPath;
  if (projectDir && opts.snapshotsDir) {
    createSnapshot({ projectId: opts.projectId, name: `pre-export-${Date.now()}`, projectDir, snapshotsDir: opts.snapshotsDir });
  }

  if (projectDir && existsSync(projectDir)) {
    const files = collectFiles(projectDir, projectDir);
    const zipBuf = createZip(files);
    writeFileSync(opts.outputPath, zipBuf);
  }
}
