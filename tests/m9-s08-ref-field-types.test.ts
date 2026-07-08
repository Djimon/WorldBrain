// @vitest-environment node
// M9-S08: Referenz-Feldtypen & DB-Prefix-Loading
// See: https://github.com/Djimon/WorldBrain/issues/220

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/plugin-fs', () => ({
  readDir: vi.fn(),
  readTextFile: vi.fn(),
}));
vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...parts: string[]) => Promise.resolve(parts.join('/'))),
}));

import * as tauriFs from '@tauri-apps/plugin-fs';

const mockReadDir = tauriFs.readDir as ReturnType<typeof vi.fn>;
const mockReadTextFile = tauriFs.readTextFile as ReturnType<typeof vi.fn>;

async function getValidator() { return import('../src/services/plugin-validator'); }
async function getRefValidator() { return import('../src/services/plugin-ref-validator'); }
async function getSchemaLoader() { return import('../src/services/plugin-schema-loader'); }
async function getEntityService() { return import('../src/services/plugin-entity-service'); }

function makeMockDb() {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
  };
}

describe('M9-S08 reference field types & db-prefix loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema field types: ref / ref[] / embedded instance', () => {
    it('ref field with valid target passes ref validation', async () => {
      const { validateEntityTypeRefs } = await getRefValidator();
      const schema = { fields: { species: { type: 'ref', target: 'species' } } };
      const errors = validateEntityTypeRefs(schema, new Set(['species', 'Character']));
      expect(errors).toEqual([]);
    });

    it('ref[] field with valid target passes ref validation', async () => {
      const { validateEntityTypeRefs } = await getRefValidator();
      const schema = { fields: { known_spells: { type: 'ref[]', target: 'spell' } } };
      const errors = validateEntityTypeRefs(schema, new Set(['spell']));
      expect(errors).toEqual([]);
    });

    it('embedded instance field ({ref, qty, equipped}) with valid ref target passes', async () => {
      const { validateEntityTypeRefs } = await getRefValidator();
      const schema = {
        fields: { inventory: { type: 'ref[]', target: 'item', instance: { qty: 'number', equipped: 'boolean' } } },
      };
      const errors = validateEntityTypeRefs(schema, new Set(['item']));
      expect(errors).toEqual([]);
    });
  });

  describe('reference integrity: invalid target rejected', () => {
    it('ref field with unknown target produces a validator error', async () => {
      const { validateEntityTypeRefs } = await getRefValidator();
      const schema = { fields: { species: { type: 'ref', target: 'nonexistent_type' } } };
      const errors = validateEntityTypeRefs(schema, new Set(['Character']));
      expect(errors.length).toBeGreaterThan(0);
    });

    it('ref[] field with unknown target produces a validator error', async () => {
      const { validateEntityTypeRefs } = await getRefValidator();
      const schema = { fields: { known_spells: { type: 'ref[]', target: 'nonexistent_type' } } };
      const errors = validateEntityTypeRefs(schema, new Set(['Character']));
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('manifest: db_prefix mandatory for system plugins', () => {
    it('system plugin without db_prefix is rejected', async () => {
      const { validatePluginManifest } = await getValidator();
      const manifest = {
        id: 'dnd5e-srd', name: 'D&D 5e SRD', version: '1.0.0', system: true,
        mechanics: { attributes: ['str'], resource_types: ['hp'], distance_units: ['ft'], challenge_metric: 'cr' },
      };
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(false);
      expect(result.errors?.join(' ')).toMatch(/db_prefix/i);
    });

    it('system plugin with db_prefix is accepted', async () => {
      const { validatePluginManifest } = await getValidator();
      const manifest = {
        id: 'dnd5e-srd', name: 'D&D 5e SRD', version: '1.0.0', system: true, db_prefix: 'dnd5e',
        mechanics: { attributes: ['str'], resource_types: ['hp'], distance_units: ['ft'], challenge_metric: 'cr' },
      };
      const result = validatePluginManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('loader: entity_types/*.json real loading + eager materialization', () => {
    it('is async', async () => {
      mockReadDir.mockResolvedValue([]);
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      const result = loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: [] },
      });
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('reads each entity_types/*.json file content (not just filenames)', async () => {
      mockReadDir.mockResolvedValue([{ name: 'player_character.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'player_character', label: 'Player Character', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: ['player_character'] },
      });
      expect(mockReadTextFile).toHaveBeenCalled();
    });

    it('calls registerPluginEntityType for each loaded entity type', async () => {
      mockReadDir.mockResolvedValue([{ name: 'player_character.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'player_character', label: 'Player Character', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const { getEntityType } = await getEntityService();
      const database = makeMockDb();
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: ['player_character'] },
      });
      expect(getEntityType('player_character')).toBeDefined();
    });

    it('materializes eager into <prefix>_* tables via database.execute', async () => {
      mockReadDir.mockResolvedValue([{ name: 'player_character.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'player_character', label: 'Player Character', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: ['player_character'] },
      });
      const calls = database.execute.mock.calls as [string, unknown[]?][];
      const createsPrefixTable = calls.some(([sql]) => /dnd5e_player_character/i.test(sql));
      expect(createsPrefixTable).toBe(true);
    });
  });

  describe('prefix isolation', () => {
    it('two plugins with different db_prefix materialize into non-colliding tables', async () => {
      mockReadDir.mockResolvedValue([{ name: 'creature.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'creature', label: 'Creature', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const dbA = makeMockDb();
      const dbB = makeMockDb();
      await loadPluginEntityTypes({
        database: dbA, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: ['creature'] },
      });
      await loadPluginEntityTypes({
        database: dbB, pluginDir: '/plugins/pf2e-srd',
        manifest: { id: 'pf2e-srd', db_prefix: 'pf2e', entity_types: ['creature'] },
      });
      const callsA = (dbA.execute.mock.calls as [string][]).map(([sql]) => sql);
      const callsB = (dbB.execute.mock.calls as [string][]).map(([sql]) => sql);
      expect(callsA.some((sql) => /dnd5e_creature/i.test(sql))).toBe(true);
      expect(callsB.some((sql) => /pf2e_creature/i.test(sql))).toBe(true);
    });
  });

  describe('security: db_prefix/entity_type identifier validation before SQL interpolation (#224)', () => {
    it('malicious db_prefix does not reach database.execute as injected DDL', async () => {
      mockReadDir.mockResolvedValue([{ name: 'player_character.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'player_character', label: 'Player Character', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      const maliciousPrefix = 'x (id TEXT); DROP TABLE entities; --';
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/evil',
        manifest: { id: 'evil', db_prefix: maliciousPrefix, entity_types: ['player_character'] },
      }).catch(() => { /* rejecting the whole load is an acceptable safe outcome */ });
      const calls = database.execute.mock.calls as [string, unknown[]?][];
      expect(calls.some(([sql]) => /drop table/i.test(sql))).toBe(false);
    });

    it('malicious entity_type id does not reach database.execute as injected DDL', async () => {
      const maliciousTypeId = 'x (id TEXT); DROP TABLE entities; --';
      mockReadDir.mockResolvedValue([{ name: `${maliciousTypeId}.json`, isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: maliciousTypeId, label: 'Evil', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: [maliciousTypeId] },
      }).catch(() => { /* rejecting the whole load is an acceptable safe outcome */ });
      const calls = database.execute.mock.calls as [string, unknown[]?][];
      expect(calls.some(([sql]) => /drop table/i.test(sql))).toBe(false);
    });

    it('valid identifiers (^[a-z][a-z0-9_]*$) still materialize normally', async () => {
      mockReadDir.mockResolvedValue([{ name: 'player_character.json', isDirectory: false }]);
      mockReadTextFile.mockResolvedValue(JSON.stringify({ id: 'player_character', label: 'Player Character', schema: {} }));
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const database = makeMockDb();
      await loadPluginEntityTypes({
        database, pluginDir: '/plugins/dnd5e-srd',
        manifest: { id: 'dnd5e-srd', db_prefix: 'dnd5e', entity_types: ['player_character'] },
      });
      const calls = database.execute.mock.calls as [string, unknown[]?][];
      expect(calls.some(([sql]) => /dnd5e_player_character/i.test(sql))).toBe(true);
    });
  });

  describe('database prop convention (AP-001)', () => {
    it('loadPluginEntityTypes accepts a DatabaseLike-shaped object without as-never cast', async () => {
      mockReadDir.mockResolvedValue([]);
      const { loadPluginEntityTypes } = await getSchemaLoader();
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      await expect(
        loadPluginEntityTypes({ database: db, pluginDir: '/p', manifest: { id: 'x', db_prefix: 'x', entity_types: [] } })
      ).resolves.not.toThrow();
    });
  });
});
