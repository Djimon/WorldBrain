// M7-S01: App-Config-Service — Tauri Plugin Mocks
// Ersetzt m7-s01-app-config-registry.test.ts.deprecated nach Tauri-Migration (#190)
// See: https://github.com/Djimon/WorldBrain/issues/191
// Hinweis: die Projekt-Registry (projects[] / registerProject / unregisterProject) ist mit
// der Umstellung auf Ordner-basierte Discovery entfallen — Projekte werden gescannt, nicht
// in der Config gelistet. app-config haelt nur noch last_opened_project_id + data_dir.

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
      mockReadTextFile.mockResolvedValue(JSON.stringify({ last_opened_project_id: null, data_dir: null }));
      const { readAppConfig } = await getAppConfigService();
      await readAppConfig();
      expect(mockReadTextFile).toHaveBeenCalled();
    });

    it('returns default config when file does not exist / read throws', async () => {
      mockReadTextFile.mockRejectedValue(new Error('ENOENT'));
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config).toHaveProperty('last_opened_project_id', null);
      expect(config).toHaveProperty('data_dir', null);
    });

    it('parses and returns config from readTextFile result', async () => {
      const stored = { last_opened_project_id: 'proj-1', data_dir: 'C:/docs/WorldsAndBeyond' };
      mockReadTextFile.mockResolvedValue(JSON.stringify(stored));
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config.last_opened_project_id).toBe('proj-1');
      expect(config.data_dir).toBe('C:/docs/WorldsAndBeyond');
    });

    it('ignores a legacy projects[] key still present in an old config file', async () => {
      const legacy = { last_opened_project_id: 'p', projects: [{ id: 'x', title: 'X', path: '/p' }], data_dir: null };
      mockReadTextFile.mockResolvedValue(JSON.stringify(legacy));
      const { readAppConfig } = await getAppConfigService();
      const config = await readAppConfig();
      expect(config).not.toHaveProperty('projects');
      expect(config.last_opened_project_id).toBe('p');
    });
  });

  describe('writeAppConfig', () => {
    it('is async (returns a Promise)', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      const result = writeAppConfig({ last_opened_project_id: null, data_dir: null });
      expect(result).toBeInstanceOf(Promise);
    });

    it('calls writeTextFile from @tauri-apps/plugin-fs', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      await writeAppConfig({ last_opened_project_id: null, data_dir: null });
      expect(mockWriteTextFile).toHaveBeenCalled();
    });

    it('writes valid JSON string to writeTextFile', async () => {
      mockWriteTextFile.mockResolvedValue(undefined);
      const { writeAppConfig } = await getAppConfigService();
      await writeAppConfig({ last_opened_project_id: 'p1', data_dir: null });
      const written = mockWriteTextFile.mock.calls[0][1] as string;
      expect(() => JSON.parse(written)).not.toThrow();
      expect(JSON.parse(written).last_opened_project_id).toBe('p1');
    });

    it('propagates errors from writeTextFile', async () => {
      mockWriteTextFile.mockRejectedValue(new Error('disk full'));
      const { writeAppConfig } = await getAppConfigService();
      await expect(writeAppConfig({ last_opened_project_id: null, data_dir: null })).rejects.toThrow();
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
