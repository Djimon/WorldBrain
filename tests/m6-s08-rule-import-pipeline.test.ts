// @vitest-environment node
// M6-S08: Rule import pipeline — JSON import, read-only flag, homebrew, override merge.
// See: https://github.com/Djimon/WorldBrain/issues/98
//
// #225: applyRuleSchema/importRules/createHomebrewRule/createRuleOverride/
// listRuleEntities were all migrated to the async DatabaseLike interface
// (MI-S00) — this test drives them through a DatabaseSync-backed async
// adapter (the pattern already established in tests/m10-s09-*), instead of
// calling them synchronously with a raw node:sqlite handle.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

async function getRuleSchema() { return import('../core_data/rule-schema'); }
async function getRuleImport() { return import('../src/services/rule-import-service'); }
function openDb() { return new DatabaseSync(':memory:'); }

const srdSpell = { id: 'spell-fireball', type: 'spell', title: 'Fireball', reference_summary: '3d6 fire damage in 20ft radius', ruleset: 'dnd5e_srd', properties: {} };

describe('M6-S08 rule import pipeline', () => {
  describe('importRules', () => {
    it('exports importRules function', async () => {
      const mod = await getRuleImport();
      expect(typeof mod.importRules).toBe('function');
    });

    it('imports rule entities as read-only', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'D&D 5e SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const row = db.prepare(`SELECT is_homebrew FROM rule_entities WHERE id='spell-fireball'`).get() as { is_homebrew: number } | undefined;
      expect(row?.is_homebrew).toBe(0);
    });

    it('creates rule_source record during import', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'D&D 5e SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const source = db.prepare(`SELECT * FROM rule_sources WHERE id='src-srd'`).get() as { is_read_only: number } | undefined;
      expect(source?.is_read_only).toBe(1);
    });

    it('duplicate rule id from same source → upsert (update), not duplicate row', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [{ ...srdSpell, title: 'Fireball v2' }] });
      const rows = db.prepare(`SELECT id FROM rule_entities WHERE id='spell-fireball'`).all();
      expect(rows.length).toBe(1);
    });

    it('same rule id from different source → two separate rows', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      db.prepare(`INSERT INTO rule_sources (id, label, license, url, is_read_only) VALUES ('src-other','Other','MIT','',1)`).run();
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      await importRules(asyncDb, { sourceId: 'src-other', sourceLabel: 'Other', license: 'MIT', url: '', rules: [srdSpell] });
      const rows = db.prepare(`SELECT id FROM rule_entities WHERE type='spell' AND title='Fireball'`).all();
      expect(rows.length).toBe(2);
    });
  });

  describe('homebrew & override', () => {
    it('createHomebrewRule creates is_homebrew=1 entity', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { createHomebrewRule } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      const result = await createHomebrewRule(asyncDb, { type: 'spell', title: 'Custom Spell', ruleset: 'homebrew', properties: {} });
      const row = db.prepare(`SELECT is_homebrew FROM rule_entities WHERE id=?`).get(result.id) as { is_homebrew: number };
      expect(row.is_homebrew).toBe(1);
    });

    it('#246: createHomebrewRule sets source_id="homebrew" (unified with createRuleOverride, not NULL)', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { createHomebrewRule } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      const result = await createHomebrewRule(asyncDb, { type: 'spell', title: 'Custom Spell', ruleset: 'homebrew', properties: {} });
      const row = db.prepare(`SELECT source_id FROM rule_entities WHERE id=?`).get(result.id) as { source_id: string | null };
      expect(row.source_id).toBe('homebrew');
    });

    it('createRuleOverride creates entity with base_entity_id set', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = await createRuleOverride(asyncDb, { baseEntityId: 'spell-fireball', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT base_entity_id, is_homebrew FROM rule_entities WHERE id=?`).get(override.id) as { base_entity_id: string; is_homebrew: number };
      expect(row.base_entity_id).toBe('spell-fireball');
      expect(row.is_homebrew).toBe(1);
    });
  });

  describe('issue #146: listRuleEntities filter.tag not silently ignored', () => {
    it('listRuleEntities({ tag }) returns only entities with that tag in properties_json', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, listRuleEntities } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, {
        sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '',
        rules: [
          { id: 'spell-fireball', type: 'spell', title: 'Fireball', reference_summary: '', ruleset: 'dnd5e_srd', properties: { tags: ['combat', 'fire'] } },
          { id: 'cond-blinded', type: 'condition', title: 'Blinded', reference_summary: '', ruleset: 'dnd5e_srd', properties: { tags: ['debuff'] } },
        ],
      });
      const result = await listRuleEntities(asyncDb, { tag: 'combat' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('spell-fireball');
    });

    it('listRuleEntities({ tag }) returns empty array when no entity has that tag', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, listRuleEntities } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, {
        sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '',
        rules: [srdSpell],
      });
      const result = await listRuleEntities(asyncDb, { tag: 'nonexistent-tag' });
      expect(result).toEqual([]);
    });
  });

  describe('issue #246: applyRuleSchema idempotently seeds canonical "homebrew" rule_sources row', () => {
    it('rule_sources contains a row with id="homebrew" after applyRuleSchema', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      const row = db.prepare(`SELECT id, is_read_only FROM rule_sources WHERE id='homebrew'`).get() as { id: string; is_read_only: number } | undefined;
      expect(row?.id).toBe('homebrew');
      expect(row?.is_read_only).toBe(0);
    });

    it('applying the schema twice does not duplicate or fail (idempotent seed)', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await expect(applyRuleSchema(asyncDb)).resolves.not.toThrow();
      const rows = db.prepare(`SELECT id FROM rule_sources WHERE id='homebrew'`).all();
      expect(rows.length).toBe(1);
    });
  });

  describe('issue #143: createRuleOverride includes source_id in INSERT', () => {
    it('createRuleOverride accepts source_id and persists it', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = await createRuleOverride(asyncDb, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT source_id FROM rule_entities WHERE id=?`).get(override.id) as { source_id: string } | undefined;
      expect(row?.source_id).toBe('homebrew');
    });

    it('createRuleOverride without explicit source_id uses sentinel "homebrew"', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = await createRuleOverride(asyncDb, { baseEntityId: 'spell-fireball', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT source_id FROM rule_entities WHERE id=?`).get(override.id) as { source_id: string } | undefined;
      expect(row?.source_id).toBeTruthy();
    });

    it('two overrides of same base entity can coexist (no PK collision)', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); const asyncDb = makeAsyncDb(db);
      await applyRuleSchema(asyncDb);
      await importRules(asyncDb, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      await expect((async () => {
        await createRuleOverride(asyncDb, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball A' } });
        await createRuleOverride(asyncDb, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball B' } });
      })()).resolves.not.toThrow();
    });
  });
});
