// @vitest-environment node
// M6-S01: Plugin manifest & loader — scan folder, parse plugin.json, populate registry.
// See: https://github.com/Djimon/WorldBrain/issues/91

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

async function getPluginLoader() { return import('../src/services/plugin-loader'); }

const tmpDirs: string[] = [];
function makePluginDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'wbx-plugins-'));
  tmpDirs.push(dir);
  return dir;
}

function writePlugin(pluginDir: string, id: string, manifest: object) {
  const dir = join(pluginDir, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'plugin.json'), JSON.stringify(manifest));
}

const validManifest = {
  id: 'test-plugin', label: 'Test Plugin', version: '1.0.0',
  compatibility: { app_schema: '>=1.0.0' },
  entity_types: [], relation_types: [], card_templates: [], views: [], rules: [], assets: [],
};

afterEach(() => {
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

describe('M6-S01 plugin manifest & loader', () => {
  describe('scanPlugins', () => {
    it('exports scanPlugins function', async () => {
      const mod = await getPluginLoader();
      expect(typeof mod.scanPlugins).toBe('function');
    });

    it('loads valid plugin from plugin folder', async () => {
      const { scanPlugins } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'test-plugin', validManifest);
      const registry = scanPlugins(dir);
      expect(registry['test-plugin']).toBeDefined();
      expect(registry['test-plugin'].manifest.label).toBe('Test Plugin');
    });

    it('load status is "loaded" for valid plugin', async () => {
      const { scanPlugins } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'test-plugin', validManifest);
      const registry = scanPlugins(dir);
      expect(registry['test-plugin'].status).toBe('loaded');
    });

    it('load order is alphabetical by folder name', async () => {
      const { scanPlugins } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'b-plugin', { ...validManifest, id: 'b-plugin' });
      writePlugin(dir, 'a-plugin', { ...validManifest, id: 'a-plugin' });
      const registry = scanPlugins(dir);
      const ids = Object.keys(registry);
      expect(ids.indexOf('a-plugin')).toBeLessThan(ids.indexOf('b-plugin'));
    });

    it('invalid plugin.json results in failed status, not crash', async () => {
      const { scanPlugins } = await getPluginLoader();
      const dir = makePluginDir();
      const badDir = join(dir, 'bad-plugin');
      mkdirSync(badDir);
      writeFileSync(join(badDir, 'plugin.json'), '{ NOT VALID JSON }');
      expect(() => scanPlugins(dir)).not.toThrow();
      const registry = scanPlugins(dir);
      expect(registry['bad-plugin']?.status).toBe('failed');
    });

    it('unknown fields in plugin.json are preserved, not errors', async () => {
      const { scanPlugins } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'future-plugin', { ...validManifest, id: 'future-plugin', future_field: 'value' });
      const registry = scanPlugins(dir);
      expect(registry['future-plugin'].status).toBe('loaded');
    });
  });

  describe('registry queries', () => {
    it('getPlugin(id) returns the plugin manifest', async () => {
      const { scanPlugins, getPlugin } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'test-plugin', validManifest);
      scanPlugins(dir);
      const plugin = getPlugin('test-plugin');
      expect(plugin?.manifest.label).toBe('Test Plugin');
    });

    it('getPluginsByResource returns plugins contributing a resource type', async () => {
      const { scanPlugins, getPluginsByResource } = await getPluginLoader();
      const dir = makePluginDir();
      writePlugin(dir, 'test-plugin', { ...validManifest, entity_types: ['Dragon'] });
      scanPlugins(dir);
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
