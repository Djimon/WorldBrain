// @vitest-environment node
// M6-S04: Plugin entity & relation types — load from plugins, integrate into registries.
// See: https://github.com/Djimon/WorldBrain/issues/94

import { describe, expect, it, vi } from 'vitest';

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
});
