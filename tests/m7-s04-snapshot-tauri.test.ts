// M7-S04: Snapshot-Service — Tauri Plugin Mocks
// Ersetzt m7-s04-snapshot-service.test.ts.deprecated nach Tauri-Migration (#190)
// See: https://github.com/Djimon/WorldBrain/issues/191

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn(),
  copyFile: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: { load: vi.fn() },
}));

import * as tauriFs from '@tauri-apps/plugin-fs';

const mockMkdir = tauriFs.mkdir as ReturnType<typeof vi.fn>;
const mockWriteTextFile = tauriFs.writeTextFile as ReturnType<typeof vi.fn>;
const mockReadDir = tauriFs.readDir as ReturnType<typeof vi.fn>;
const mockReadTextFile = tauriFs.readTextFile as ReturnType<typeof vi.fn>;
const mockRemove = tauriFs.remove as ReturnType<typeof vi.fn>;
const mockCopyFile = tauriFs.copyFile as ReturnType<typeof vi.fn>;

async function getSnapshotService() { return import('../src/services/snapshot-service'); }

const BASE_ARGS = { projectId: 'proj-1', name: 'Before Rewrite', projectDir: '/p', snapshotsDir: '/s' };

describe('M7-S04 snapshot-service (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteTextFile.mockResolvedValue(undefined);
    mockCopyFile.mockResolvedValue(undefined);
    mockRemove.mockResolvedValue(undefined);
  });

  describe('createSnapshot', () => {
    it('is async (returns a Promise)', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { createSnapshot } = await getSnapshotService();
      const result = createSnapshot(BASE_ARGS);
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls mkdir from @tauri-apps/plugin-fs to create snapshot directory', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { createSnapshot } = await getSnapshotService();
      await createSnapshot(BASE_ARGS);
      expect(mockMkdir).toHaveBeenCalled();
    });

    it('calls writeTextFile to persist snapshot.json', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { createSnapshot } = await getSnapshotService();
      await createSnapshot(BASE_ARGS);
      const calls = mockWriteTextFile.mock.calls;
      const snapCall = calls.find(c => (c[0] as string).includes('snapshot.json'));
      expect(snapCall).toBeTruthy();
    });

    it('snapshot.json written contains name and createdAt', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { createSnapshot } = await getSnapshotService();
      await createSnapshot(BASE_ARGS);
      const calls = mockWriteTextFile.mock.calls;
      const snapCall = calls.find(c => (c[0] as string).includes('snapshot.json'));
      const meta = JSON.parse(snapCall![1] as string);
      expect(meta.name).toBe('Before Rewrite');
      expect(meta.createdAt).toBeTruthy();
    });

    it('calls copyFile for each project file', async () => {
      mockReadDir.mockResolvedValue([
        { name: 'project.json', isFile: true },
        { name: 'entities', isDirectory: true, children: [] },
      ]);
      const { createSnapshot } = await getSnapshotService();
      await createSnapshot(BASE_ARGS);
      expect(mockCopyFile).toHaveBeenCalled();
    });

    it('returns object with id', async () => {
      mockReadDir.mockResolvedValue([]);
      const { createSnapshot } = await getSnapshotService();
      const result = await createSnapshot(BASE_ARGS);
      expect(result.id).toBeTruthy();
    });
  });

  describe('listSnapshots', () => {
    it('is async (returns a Promise)', async () => {
      mockReadDir.mockResolvedValue([]);
      const { listSnapshots } = await getSnapshotService();
      const result = listSnapshots({ snapshotsDir: '/s' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls readDir from @tauri-apps/plugin-fs', async () => {
      mockReadDir.mockResolvedValue([]);
      const { listSnapshots } = await getSnapshotService();
      await listSnapshots({ snapshotsDir: '/s' });
      expect(mockReadDir).toHaveBeenCalled();
    });

    it('returns empty array when readDir returns no entries', async () => {
      mockReadDir.mockResolvedValue([]);
      const { listSnapshots } = await getSnapshotService();
      const list = await listSnapshots({ snapshotsDir: '/s' });
      expect(list).toEqual([]);
    });

    it('reads snapshot.json for each directory entry', async () => {
      mockReadDir.mockResolvedValue([{ name: 'snap-01', isDirectory: true }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'snap-01', name: 'My Snap', createdAt: '2026-01-01T00:00:00Z', sizeBytes: 1024 }));
      const { listSnapshots } = await getSnapshotService();
      const list = await listSnapshots({ snapshotsDir: '/s' });
      expect(list[0].name).toBe('My Snap');
    });

    it('propagates async errors from readDir', async () => {
      mockReadDir.mockRejectedValue(new Error('permission denied'));
      const { listSnapshots } = await getSnapshotService();
      await expect(listSnapshots({ snapshotsDir: '/s' })).rejects.toThrow();
    });
  });

  describe('deleteSnapshot', () => {
    it('is async (returns a Promise)', async () => {
      const { deleteSnapshot } = await getSnapshotService();
      const result = deleteSnapshot({ id: 'snap-1', snapshotsDir: '/s' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls remove from @tauri-apps/plugin-fs', async () => {
      const { deleteSnapshot } = await getSnapshotService();
      await deleteSnapshot({ id: 'snap-1', snapshotsDir: '/s' });
      expect(mockRemove).toHaveBeenCalled();
    });
  });

  describe('restoreSnapshot', () => {
    it('is async (returns a Promise)', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { restoreSnapshot } = await getSnapshotService();
      const result = restoreSnapshot({ id: 'snap-1', projectDir: '/p', snapshotsDir: '/s' });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls copyFile to copy files back to projectDir', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      const { restoreSnapshot } = await getSnapshotService();
      await restoreSnapshot({ id: 'snap-1', projectDir: '/p', snapshotsDir: '/s' });
      expect(mockCopyFile).toHaveBeenCalled();
    });
  });

  describe('no direct node:fs usage', () => {
    it('snapshot-service.ts does not import from node:fs', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/snapshot-service.ts', 'utf-8'));
      expect(src).not.toMatch(/from ['"]node:fs['"]/);
    });
  });
});
