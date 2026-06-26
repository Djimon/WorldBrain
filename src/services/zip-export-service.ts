import { exists, readDir, readFile, writeFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
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

function makeRelative(baseDir: string, fullPath: string): string {
  const base = baseDir.replace(/\\/g, '/').replace(/\/$/, '') + '/';
  return fullPath.replace(/\\/g, '/').replace(base, '');
}

async function collectFiles(dir: string, baseDir: string): Promise<Array<{ name: string; data: Buffer }>> {
  const results: Array<{ name: string; data: Buffer }> = [];
  for (const dirent of await readDir(dir)) {
    const full = await join(dir, dirent.name);
    const rel = makeRelative(baseDir, full);
    if (isExcluded(rel)) continue;
    if (dirent.isDirectory) {
      results.push(...await collectFiles(full, baseDir));
    } else {
      const data = Buffer.from(await readFile(full));
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
    await createSnapshot({ projectId: opts.projectId, name: `pre-export-${Date.now()}`, projectDir, snapshotsDir: opts.snapshotsDir });
  }

  if (projectDir && (await exists(projectDir))) {
    const files = await collectFiles(projectDir, projectDir);
    const zipBuf = createZip(files);
    await writeFile(opts.outputPath, new Uint8Array(zipBuf));
  }
}
