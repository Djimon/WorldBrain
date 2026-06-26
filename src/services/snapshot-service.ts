// @tauri-apps/plugin-fs
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from './_fs';
import { join } from './_path';

export interface SnapshotEntry {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
}

interface SnapshotMeta {
  id: string;
  name: string;
  createdAt: string;
}


function copyDirSync(src: string, dest: string, exclude?: string): void {
  mkdirSync(dest, { recursive: true });
  for (const dirent of readdirSync(src, { withFileTypes: true })) {
    const srcFull = join(src, dirent.name);
    if (exclude && srcFull === exclude) continue;
    const destFull = join(dest, dirent.name);
    if (dirent.isDirectory()) copyDirSync(srcFull, destFull, exclude);
    else copyFileSync(srcFull, destFull);
  }
}

export function createSnapshot(opts: {
  projectId: string;
  name: string;
  projectDir?: string;
  snapshotsDir?: string;
  projectPath?: string;
}): { id: string } {
  const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const snapshotsDir = opts.snapshotsDir;
  const projectDir = opts.projectDir ?? opts.projectPath;

  if (snapshotsDir && projectDir) {
    const snapDir = join(snapshotsDir, id);
    mkdirSync(snapDir, { recursive: true });
    copyDirSync(projectDir, snapDir, snapshotsDir);
    const meta: SnapshotMeta = { id, name: opts.name, createdAt: new Date().toISOString() };
    writeFileSync(join(snapDir, 'snapshot.json'), JSON.stringify(meta, null, 2), 'utf-8');
  }

  return { id };
}

export function listSnapshots(opts: { projectId?: string; snapshotsDir?: string }): SnapshotEntry[] {
  const snapshotsDir = opts.snapshotsDir;
  if (!snapshotsDir || !existsSync(snapshotsDir)) return [];

  const entries: SnapshotEntry[] = [];
  for (const dirent of readdirSync(snapshotsDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const snapDir = join(snapshotsDir, dirent.name);
    const metaPath = join(snapDir, 'snapshot.json');
    if (!existsSync(metaPath)) continue;
    try {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as SnapshotMeta;
      entries.push({ id: meta.id, name: meta.name, createdAt: meta.createdAt, sizeBytes: 0 });
    } catch {
      // AP-006 exception: corrupt snapshot.json at filesystem boundary — skip entry
    }
  }
  return entries;
}

export function deleteSnapshot(opts: string | { id: string; snapshotsDir?: string }): void {
  if (typeof opts === 'string') return;
  const { id, snapshotsDir } = opts;
  if (!snapshotsDir) return;
  const snapDir = join(snapshotsDir, id);
  if (existsSync(snapDir)) rmSync(snapDir, { recursive: true, force: true });
}

export function restoreSnapshot(opts: {
  snapshotId?: string;
  id?: string;
  projectDir?: string;
  projectPath?: string;
  snapshotsDir?: string;
}): void {
  const id = opts.id ?? opts.snapshotId;
  const projectDir = opts.projectDir ?? opts.projectPath;
  const { snapshotsDir } = opts;
  if (!id || !projectDir || !snapshotsDir) return;

  const snapDir = join(snapshotsDir, id);
  if (!existsSync(snapDir)) return;
  rmSync(projectDir, { recursive: true, force: true });
  copyDirSync(snapDir, projectDir);
  const metaInProject = join(projectDir, 'snapshot.json');
  if (existsSync(metaInProject)) rmSync(metaInProject);
}
