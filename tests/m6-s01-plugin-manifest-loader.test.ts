// @vitest-environment node
// M6-S01: Plugin manifest & loader — scan folder, parse plugin.json, populate registry.
// See: https://github.com/Djimon/WorldBrain/issues/91
//
// #225: scanPlugins moved to the async Tauri-fs interface (MI-S00 migration) —
// this test now mocks @tauri-apps/plugin-fs / @tauri-apps/api/path instead of
// writing to a real temp directory, matching the established pattern used by
// the M7 Tauri-migrated test suites (e.g. m7-s01-app-config-tauri.test.ts).

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));

import * as tauriFs from '@tauri-apps/plugin-fs';

const mockReadDir = tauriFs.readDir as ReturnType<typeof vi.fn>;
const mockReadTextFile = tauriFs.readTextFile as ReturnType<typeof vi.fn>;

async function getPluginLoader() { return import('../src/services/plugin-loader'); }

const PLUGIN_DIR = '/plugins';

const validManifest = {
  id: 'test-plugin', name: 'Test Plugin', version: '1.0.0',
  entity_types: [], relation_types: [], card_templates: [], views: [], rules: [], assets: [],
};

// Registers a folder's plugin.json content for the mocked readTextFile.
function mockPluginFiles(files: Record<string, object | string>) {
  mockReadTextFile.mockImplementation((path: string) => {
    for (const [folder, content] of Object.entries(files)) {
      if (path === `${PLUGIN_DIR}/${folder}/plugin.json`) {
        return Promise.resolve(typeof content === 'string' ? content : JSON.stringify(content));
      }
    }
    return Promise.reject(new Error(`ENOENT: ${path}`));
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('M6-S01 plugin manifest & loader', () => {
  describe('scanPlugins', () => {
    it('exports scanPlugins function', async () => {
      const mod = await getPluginLoader();
      expect(typeof mod.scanPlugins).toBe('function');
    });

    it('loads valid plugin from plugin folder', async () => {
      const { scanPlugins } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'test-plugin', isDirectory: true }]);
      mockPluginFiles({ 'test-plugin': validManifest });
      const registry = await scanPlugins(PLUGIN_DIR);
      expect(registry['test-plugin']).toBeDefined();
      expect(registry['test-plugin'].manifest.name).toBe('Test Plugin');
    });

    it('load status is "loaded" for valid plugin', async () => {
      const { scanPlugins } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'test-plugin', isDirectory: true }]);
      mockPluginFiles({ 'test-plugin': validManifest });
      const registry = await scanPlugins(PLUGIN_DIR);
      expect(registry['test-plugin'].status).toBe('loaded');
    });

    it('load order is alphabetical by folder name', async () => {
      const { scanPlugins } = await getPluginLoader();
      mockReadDir.mockResolvedValue([
        { name: 'b-plugin', isDirectory: true },
        { name: 'a-plugin', isDirectory: true },
      ]);
      mockPluginFiles({
        'b-plugin': { ...validManifest, id: 'b-plugin' },
        'a-plugin': { ...validManifest, id: 'a-plugin' },
      });
      const registry = await scanPlugins(PLUGIN_DIR);
      const ids = Object.keys(registry);
      expect(ids.indexOf('a-plugin')).toBeLessThan(ids.indexOf('b-plugin'));
    });

    it('invalid plugin.json results in failed status, not crash', async () => {
      const { scanPlugins } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'bad-plugin', isDirectory: true }]);
      mockPluginFiles({ 'bad-plugin': '{ NOT VALID JSON }' });
      await expect(scanPlugins(PLUGIN_DIR)).resolves.toBeDefined();
      const registry = await scanPlugins(PLUGIN_DIR);
      expect(registry['bad-plugin']?.status).toBe('failed');
    });

    it('unknown fields in plugin.json are preserved, not errors', async () => {
      const { scanPlugins } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'future-plugin', isDirectory: true }]);
      mockPluginFiles({ 'future-plugin': { ...validManifest, id: 'future-plugin', future_field: 'value' } });
      const registry = await scanPlugins(PLUGIN_DIR);
      expect(registry['future-plugin'].status).toBe('loaded');
    });
  });

  describe('registry queries', () => {
    it('getPlugin(id) returns the plugin manifest', async () => {
      const { scanPlugins, getPlugin } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'test-plugin', isDirectory: true }]);
      mockPluginFiles({ 'test-plugin': validManifest });
      await scanPlugins(PLUGIN_DIR);
      const plugin = getPlugin('test-plugin');
      expect(plugin?.manifest.name).toBe('Test Plugin');
    });

    it('getPluginsByResource returns plugins contributing a resource type', async () => {
      const { scanPlugins, getPluginsByResource } = await getPluginLoader();
      mockReadDir.mockResolvedValue([{ name: 'test-plugin', isDirectory: true }]);
      mockPluginFiles({ 'test-plugin': { ...validManifest, entity_types: ['Dragon'] } });
      await scanPlugins(PLUGIN_DIR);
      const plugins = getPluginsByResource('entity_types');
      expect(plugins.some((p: { manifest: { id: string } }) => p.manifest.id === 'test-plugin')).toBe(true);
    });
  });

  describe('issue #145: AP-006 comment required on filesystem catch blocks', () => {
    it('every empty catch block in plugin-loader.ts has a comment', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/services/plugin-loader.ts', 'utf-8'));
      // Find all catch blocks that are empty or near-empty
      const catchBlocks = [...src.matchAll(/catch\s*\([^)]*\)\s*\{([^}]*)\}/g)];
      for (const match of catchBlocks) {
        const body = match[1];
        // A catch body with no statements must contain a comment (AP-006 exception)
        if (body.trim() === '' || !/\S/.test(body.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, ''))) {
          expect(body).toMatch(/\/\/|\/\*/);
        }
      }
    });
  });
});
