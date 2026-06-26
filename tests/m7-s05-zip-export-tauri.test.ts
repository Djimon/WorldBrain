// M7-S05: ZIP-Export-Service — Tauri Plugin Mocks
// Ersetzt m7-s05-zip-export-service.test.ts.deprecated und m7-s05-zip-export.test.ts.deprecated
// nach Tauri-Migration (#190)
// See: https://github.com/Djimon/WorldBrain/issues/191

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
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

const mockReadDir = tauriFs.readDir as ReturnType<typeof vi.fn>;
const mockReadFile = tauriFs.readFile as ReturnType<typeof vi.fn>;
const mockWriteFile = tauriFs.writeFile as ReturnType<typeof vi.fn>;

async function getZipExportService() { return import('../src/services/zip-export-service'); }

describe('M7-S05 zip-export-service (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockWriteFile.mockResolvedValue(undefined);
  });

  describe('exportProjectToZip', () => {
    it('is async (returns a Promise)', async () => {
      mockReadDir.mockResolvedValue([]);
      const { exportProjectToZip } = await getZipExportService();
      const result = exportProjectToZip({
        projectId: 'proj-1', projectDir: '/p', outputPath: '/out/p.zip', snapshotsDir: '/s',
      });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls readDir to collect project files', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      mockReadFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
      const { exportProjectToZip } = await getZipExportService();
      await exportProjectToZip({ projectId: 'proj-1', projectDir: '/p', outputPath: '/out/p.zip', snapshotsDir: '/s' });
      expect(mockReadDir).toHaveBeenCalled();
    });

    it('calls writeFile to write the ZIP output', async () => {
      mockReadDir.mockResolvedValue([{ name: 'project.json', isFile: true }]);
      mockReadFile.mockResolvedValue(new Uint8Array([123]));
      const { exportProjectToZip } = await getZipExportService();
      await exportProjectToZip({ projectId: 'proj-1', projectDir: '/p', outputPath: '/out/p.zip', snapshotsDir: '/s' });
      expect(mockWriteFile).toHaveBeenCalledWith('/out/p.zip', expect.any(Uint8Array));
    });

    it('uses readFile (binary) from @tauri-apps/plugin-fs, not readFileSync', async () => {
      mockReadDir.mockResolvedValue([{ name: 'data.json', isFile: true }]);
      mockReadFile.mockResolvedValue(new Uint8Array([10, 20]));
      const { exportProjectToZip } = await getZipExportService();
      await exportProjectToZip({ projectId: 'proj-1', projectDir: '/p', outputPath: '/out/p.zip', snapshotsDir: '/s' });
      expect(mockReadFile).toHaveBeenCalled();
    });

    it('does not include .sqlite files in ZIP', async () => {
      mockReadDir.mockResolvedValue([
        { name: 'project.json', isFile: true },
        { name: 'runtime.sqlite', isFile: true },
      ]);
      mockReadFile.mockResolvedValue(new Uint8Array([1]));
      const { exportProjectToZip } = await getZipExportService();
      await exportProjectToZip({ projectId: 'proj-1', projectDir: '/p', outputPath: '/out/p.zip', snapshotsDir: '/s' });
      // readFile should only be called for project.json, not runtime.sqlite
      const readFilePaths = mockReadFile.mock.calls.map(c => c[0] as string);
      expect(readFilePaths.every(p => !p.endsWith('.sqlite'))).toBe(true);
    });

    it('propagates errors from readDir', async () => {
      mockReadDir.mockRejectedValue(new Error('not found'));
      const { exportProjectToZip } = await getZipExportService();
      await expect(exportProjectToZip({ projectId: 'p', projectDir: '/p', outputPath: '/o.zip', snapshotsDir: '/s' }))
        .rejects.toThrow();
    });
  });

  describe('buildZipFilename', () => {
    it('generates filename without spaces', async () => {
      const { buildZipFilename } = await getZipExportService();
      const name = await buildZipFilename({ title: 'Forgotten Realms', date: '2026-06-25' });
      expect(name).not.toContain(' ');
    });

    it('filename ends with .zip', async () => {
      const { buildZipFilename } = await getZipExportService();
      const name = await buildZipFilename({ title: 'World', date: '2026-01-01' });
      expect(name).toMatch(/\.zip$/);
    });

    it('filename includes sanitized project title', async () => {
      const { buildZipFilename } = await getZipExportService();
      const name = await buildZipFilename({ title: 'Forgotten Realms', date: '2026-06-25' });
      expect(name.toLowerCase()).toContain('forgotten');
    });
  });

  describe('no direct node:fs usage', () => {
    it('zip-export-service.ts does not import from node:fs', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/zip-export-service.ts', 'utf-8'));
      expect(src).not.toMatch(/from ['"]node:fs['"]/);
    });
  });
});
