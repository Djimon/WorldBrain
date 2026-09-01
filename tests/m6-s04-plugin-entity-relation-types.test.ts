// @vitest-environment node
// M6-S04: Plugin entity & relation types — load from plugins, integrate into registries.
// See: https://github.com/Djimon/WorldBrain/issues/94

import { describe, expect, it, vi } from 'vitest';

// #225: the loader uses the async Tauri-fs interface — mock it (same pattern as
// m6-s01) so scanPlugins can seed the registry the conflict-status path mutates.
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

const PLUGIN_DIR = '/plugins';

function seedPlugins(folders: string[]) {
  mockReadDir.mockResolvedValue(folders.map((name) => ({ name, isDirectory: true })));
  mockReadTextFile.mockImplementation((path: string) => {
    for (const folder of folders) {
      if (path === `${PLUGIN_DIR}/${folder}/plugin.json`) {
        return Promise.resolve(JSON.stringify({ id: folder, name: folder, version: '1.0.0' }));
      }
    }
    return Promise.reject(new Error(`ENOENT: ${path}`));
  });
}

async function getPluginEntityService() { return import('../src/services/plugin-entity-service'); }

const dragonEntityType = {
  id: 'dragon',
  label: 'Dragon',
  schema: { type: 'object', properties: { age: { type: 'number' }, breath: { type: 'string' } } },
  color: '#cc3300',
};

const hoardsRelationType = {
  id: 'hoards',
  relation_type: 'hoards',
  inverse_type: 'hoarded_by',
  symmetry: 'directed',
  label: 'hoards',
  inverse_label: 'hoarded by',
};

describe('M6-S04 plugin entity & relation types', () => {
  describe('registerPluginEntityType', () => {
    it('exports registerPluginEntityType function', async () => {
      const mod = await getPluginEntityService();
      expect(typeof mod.registerPluginEntityType).toBe('function');
    });

    it('registered entity type retrievable by id', async () => {
      const { registerPluginEntityType, getEntityType } = await getPluginEntityService();
      registerPluginEntityType(dragonEntityType);
      const result = getEntityType('dragon');
      expect(result?.label).toBe('Dragon');
    });

    it('plugin entity type appears alongside core types in listEntityTypes', async () => {
      const { registerPluginEntityType, listEntityTypes } = await getPluginEntityService();
      registerPluginEntityType(dragonEntityType);
      const types = listEntityTypes();
      expect(types.some((t: { id: string }) => t.id === 'dragon')).toBe(true);
      // Core types still present
      expect(types.some((t: { id: string }) => t.id === 'Character')).toBe(true);
    });
  });

  describe('registerPluginRelationType', () => {
    it('exports registerPluginRelationType function', async () => {
      const mod = await getPluginEntityService();
      expect(typeof mod.registerPluginRelationType).toBe('function');
    });

    it('registered relation type retrievable by id', async () => {
      const { registerPluginRelationType, getRelationTypeDefinition } = await getPluginEntityService();
      registerPluginRelationType(hoardsRelationType);
      const result = getRelationTypeDefinition('hoards');
      expect(result?.label).toBe('hoards');
    });
  });

  describe('conflict handling', () => {
    it('second plugin with same entity type id wins and logs warning', async () => {
      const { registerPluginEntityType, getEntityType } = await getPluginEntityService();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerPluginEntityType({ ...dragonEntityType, label: 'Dragon v1' });
      registerPluginEntityType({ ...dragonEntityType, label: 'Dragon v2' });
      expect(getEntityType('dragon')?.label).toBe('Dragon v2');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('outdated_schema flag', () => {
    it('exports flagOutdatedSchema function', async () => {
      const mod = await getPluginEntityService();
      expect(typeof mod.flagOutdatedSchema).toBe('function');
    });
  });

  // Delivered mechanism: registerPluginEntityType(type, pluginId) marks the
  // loader-registry entry's status as 'conflict' (and appends an error) when
  // the entity-type id is already registered — pluginId is the 2nd argument,
  // and the conflict surfaces via plugin-loader's getPlugin(), not a separate
  // getPluginConflicts() export.
  describe('issue #144: conflict sets plugin registry status to "conflict"', () => {
    it('conflicting entity type sets the plugin status to "conflict" in the loader registry', async () => {
      const { registerPluginEntityType } = await getPluginEntityService();
      const { scanPlugins, getPlugin } = await import('../src/services/plugin-loader');
      seedPlugins(['plugin-a', 'plugin-b']);
      await scanPlugins(PLUGIN_DIR);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      registerPluginEntityType({ ...dragonEntityType, id: 'dragon' }, 'plugin-a');
      registerPluginEntityType({ ...dragonEntityType, id: 'dragon' }, 'plugin-b');
      warnSpy.mockRestore();

      expect(getPlugin('plugin-b')?.status).toBe('conflict');
    });

    it('records the conflict as an error on the loader registry entry', async () => {
      const { registerPluginEntityType } = await getPluginEntityService();
      const { scanPlugins, getPlugin } = await import('../src/services/plugin-loader');
      seedPlugins(['plugin-b']);
      await scanPlugins(PLUGIN_DIR);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // 'dragon' is already registered by earlier tests / prior line; registering
      // it again under plugin-b triggers the conflict path.
      registerPluginEntityType({ ...dragonEntityType, id: 'dragon' }, 'plugin-b');
      warnSpy.mockRestore();

      const entry = getPlugin('plugin-b');
      expect(entry?.status).toBe('conflict');
      expect(entry?.errors?.some((e) => e.includes('dragon'))).toBe(true);
    });
  });
});
