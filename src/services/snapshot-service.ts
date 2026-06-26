import { copyFile, exists, mkdir, readDir, readTextFile, remove, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

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

async function copyDirAsync(src: string, dest: string, excludeNorm?: string, depth = 0): Promise<void> {
  if (depth > 50) return;
  await mkdir(dest, { recursive: true });
  const entries = await readDir(src);
  for (const entry of entries) {
    const srcFull = await join(src, entry.name);
    // Normalize both sides so Windows backslash vs forward-slash doesn't break the comparison.
    // Also use startsWith so any nested path under excludeNorm is also skipped.
    if (excludeNorm) {
      const srcNorm = await join(srcFull);
      if (srcNorm === excludeNorm || srcNorm.startsWith(excludeNorm + '\\') || srcNorm.startsWith(excludeNorm + '/')) continue;
    }
    const destFull = await join(dest, entry.name);
    if (entry.isDirectory) {
      await copyDirAsync(srcFull, destFull, excludeNorm, depth + 1);
    } else {
      await copyFile(srcFull, destFull);
    }
  }
}

export async function createSnapshot(opts: {
  projectId: string;
  name: string;
  projectDir?: string;
  snapshotsDir?: string;
  projectPath?: string;
}): Promise<{ id: string }> {
  const id = `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const snapshotsDir = opts.snapshotsDir;
  const projectDir = opts.projectDir ?? opts.projectPath;

  if (snapshotsDir && projectDir) {
    const snapDir = await join(snapshotsDir, id);
    await mkdir(snapDir, { recursive: true });
    // Normalize snapshotsDir via join() so separators match what join() returns during recursion.
    const snapshotsDirNorm = await join(snapshotsDir);
    await copyDirAsync(projectDir, snapDir, snapshotsDirNorm);
    const meta: SnapshotMeta = { id, name: opts.name, createdAt: new Date().toISOString() };
    await writeTextFile(await join(snapDir, 'snapshot.json'), JSON.stringify(meta, null, 2));
  }

  return { id };
}

export async function listSnapshots(opts: { projectId?: string; snapshotsDir?: string }): Promise<SnapshotEntry[]> {
  const snapshotsDir = opts.snapshotsDir;
  if (!snapshotsDir || !(await exists(snapshotsDir))) return [];

  const entries: SnapshotEntry[] = [];
  for (const dirent of await readDir(snapshotsDir)) {
    if (!dirent.isDirectory) continue;
    const snapDir = await join(snapshotsDir, dirent.name);
    const metaPath = await join(snapDir, 'snapshot.json');
    if (!(await exists(metaPath))) continue;
    try {
      const meta = JSON.parse(await readTextFile(metaPath)) as SnapshotMeta;
      entries.push({ id: meta.id, name: meta.name, createdAt: meta.createdAt, sizeBytes: 0 });
    } catch {
      // AP-006 exception: corrupt snapshot.json at filesystem boundary — skip entry
    }
  }
  return entries;
}

export async function deleteSnapshot(opts: string | { id: string; snapshotsDir?: string }): Promise<void> {
  if (typeof opts === 'string') return;
  const { id, snapshotsDir } = opts;
  if (!snapshotsDir) return;
  const snapDir = await join(snapshotsDir, id);
  if (await exists(snapDir)) await remove(snapDir, { recursive: true });
}

export async function restoreSnapshot(opts: {
  snapshotId?: string;
  id?: string;
  projectDir?: string;
  projectPath?: string;
  snapshotsDir?: string;
}): Promise<void> {
  const id = opts.id ?? opts.snapshotId;
  const projectDir = opts.projectDir ?? opts.projectPath;
  const { snapshotsDir } = opts;
  if (!id || !projectDir || !snapshotsDir) return;

  const snapDir = await join(snapshotsDir, id);
  if (!(await exists(snapDir))) return;
  await remove(projectDir, { recursive: true });
  await copyDirAsync(snapDir, projectDir);
  const metaInProject = await join(projectDir, 'snapshot.json');
  if (await exists(metaInProject)) await remove(metaInProject);
}
