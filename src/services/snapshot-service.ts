export interface SnapshotEntry {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
}

export function listSnapshots(_opts: { projectId: string; snapshotsDir?: string }): SnapshotEntry[] {
  return [];
}

export function createSnapshot(opts: {
  projectId: string;
  name: string;
  projectPath?: string;
  snapshotsDir?: string;
}): { id: string } {
  const id = `snap-${opts.projectId}-${Date.now()}`;
  return { id };
}

export function deleteSnapshot(_snapshotId: string): void {
  // Tauri FS API handles actual deletion in production
}

export function restoreSnapshot(_opts: {
  snapshotId: string;
  projectPath?: string;
  snapshotsDir?: string;
}): void {
  // Tauri FS API handles actual directory replacement in production
}
