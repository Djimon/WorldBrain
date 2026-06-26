// M7-S01: App-Config-Service — Tauri Plugin Mocks
// Ersetzt m7-s01-app-config-registry.test.ts.deprecated nach Tauri-Migration (#190)
// See: https://github.com/Djimon/WorldBrain/issues/191

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const mockReadTextFile = tauriFs.readTextFile as ReturnType<typeof vi.fn>;
const mockWriteTextFile = tauriFs.writeTextFile as ReturnType<typeof vi.fn>;
const mockExists = tauriFs.exists as ReturnType<typeof vi.fn>;

async function getAppConfigService() {
  // Reset module registry so each test starts fresh
  return import('../src/services/app-config-service');
}

describe('M7-S01 app-config-service (Tauri)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('readAppConfig', () => {
    it('is async (returns a Promise)', async () => {
      mockExists.mockResolvedValue(false);
      const { readAppConfig } = await getAppConfigService();
      const result = readAppConfig();
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls readTextFile from @tauri-apps/plugin-fs', async () => {
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ last_opened_project_id: null, projects: [] }));
      const { readAppConfig } = await getAppConfigService();
      await readAppConfig();
      expect(mockReadTextFile).toHaveBeenCalled();
    });

    it('returns default config when file does not exist', async () => {
      mockExists.mockResolvedValue(false);
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config).toHaveProperty('last_opened_project_id');
      expect(config).toHaveProperty('projects');
      expect(config.projects).toEqual([]);
    });

    it('returns default config when readTextFile throws (corrupt file)', async () => {
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockRejectedValue(new Error('parse error'));
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config).toHaveProperty('projects');
    });

    it('parses and returns config from readTextFile result', async () => {
      const stored = { last_opened_project_id: 'proj-1', projects: [{ id: 'proj-1', title: 'World', path: '/p' }] };
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(stored));
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config.last_opened_project_id).toBe('proj-1');
      expect(config.projects.length).toBe(1);
    });
  });

  describe('writeAppConfig', () => {
    it('is async (returns a Promise)', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      const result = writeAppConfig({ last_opened_project_id: null, projects: [] });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls writeTextFile from @tauri-apps/plugin-fs', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      await writeAppConfig({ last_opened_project_id: null, projects: [] });
      expect(mockWriteTextFile).toHaveBeenCalled();
    });

    it('writes valid JSON string to writeTextFile', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      await writeAppConfig({ last_opened_project_id: 'p1', projects: [] });
      const written = mockWriteTextFile.mock.calls[0][1] as string;
      expect(() => JSON.parse(written)).not.toThrow();
      expect(JSON.parse(written).last_opened_project_id).toBe('p1');
    });

    it('propagates errors from writeTextFile', async () => {
      mockWriteTextFile.mockRejectedValue(new Error('disk full'));
      const { writeAppConfig } = await getAppConfigService();
      await expect(writeAppConfig({ last_opened_project_id: null, projects: [] })).rejects.toThrow();
    });
  });

  describe('registerProject', () => {
    it('reads config, adds project entry, writes back', async () => {
      const initial = { last_opened_project_id: null, projects: [] };
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(initial));
      mockWriteTextFile.mockResolvedValue(undefined);
      const { registerProject } = await getAppConfigService();
      await registerProject({ id: 'proj-new', title: 'New World', path: '/worlds/new' });
      const written = JSON.parse(mockWriteTextFile.mock.calls[0][1] as string);
      expect(written.projects.some((p: { id: string }) => p.id === 'proj-new')).toBe(true);
    });
  });

  describe('unregisterProject', () => {
    it('reads config, removes project entry by id, writes back', async () => {
      const initial = {
        last_opened_project_id: 'proj-1',
        projects: [{ id: 'proj-1', title: 'World', path: '/p' }],
      };
      mockExists.mockResolvedValue(true);
      mockReadTextFile.mockResolvedValue(JSON.stringify(initial));
      mockWriteTextFile.mockResolvedValue(undefined);
      const { unregisterProject } = await getAppConfigService();
      await unregisterProject('proj-1');
      const written = JSON.parse(mockWriteTextFile.mock.calls[0][1] as string);
      expect(written.projects.every((p: { id: string }) => p.id !== 'proj-1')).toBe(true);
    });
  });

  describe('no direct node:fs usage', () => {
    it('app-config-service.ts does not import from node:fs', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/app-config-service.ts', 'utf-8'));
      expect(src).not.toMatch(/from ['"]node:fs['"]/);
    });

    it('app-config-service.ts does not import from node:path', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/app-config-service.ts', 'utf-8'));
      expect(src).not.toMatch(/from ['"]node:path['"]/);
    });
  });
});
