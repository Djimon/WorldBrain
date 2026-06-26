// @vitest-environment node
// M6-S08: Rule import pipeline — JSON import, read-only flag, homebrew, override merge.
// See: https://github.com/Djimon/WorldBrain/issues/98

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getRuleSchema() { return import('../core_data/rule-schema'); }
async function getRuleImport() { return import('../src/services/rule-import-service'); }
function openDb() { return new DatabaseSync(':memory:'); }

const srdSpell = { id: 'spell-fireball', type: 'spell', title: 'Fireball', reference_summary: '3d6 fire damage in 20ft radius', ruleset: 'dnd5e_srd', properties: {} };
const srdCondition = { id: 'cond-blinded', type: 'condition', title: 'Blinded', reference_summary: 'Cannot see', ruleset: 'dnd5e_srd', properties: {} };

describe('M6-S08 rule import pipeline', () => {
  describe('importRules', () => {
    it('exports importRules function', async () => {
      const mod = await getRuleImport();
      expect(typeof mod.importRules).toBe('function');
    });

    it('imports rule entities as read-only', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'D&D 5e SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const row = db.prepare(`SELECT is_homebrew FROM rule_entities WHERE id='spell-fireball'`).get() as { is_homebrew: number } | undefined;
      expect(row?.is_homebrew).toBe(0);
    });

    it('creates rule_source record during import', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'D&D 5e SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const source = db.prepare(`SELECT * FROM rule_sources WHERE id='src-srd'`).get() as { is_read_only: number } | undefined;
      expect(source?.is_read_only).toBe(1);
    });

    it('duplicate rule id from same source → upsert (update), not duplicate row', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [{ ...srdSpell, title: 'Fireball v2' }] });
      const rows = db.prepare(`SELECT id FROM rule_entities WHERE id='spell-fireball'`).all();
      expect(rows.length).toBe(1);
    });

    it('same rule id from different source → two separate rows', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      db.prepare(`INSERT INTO rule_sources (id, label, license, url, is_read_only) VALUES ('src-other','Other','MIT','',1)`).run();
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      importRules(db, { sourceId: 'src-other', sourceLabel: 'Other', license: 'MIT', url: '', rules: [srdSpell] });
      const rows = db.prepare(`SELECT id FROM rule_entities WHERE type='spell' AND title='Fireball'`).all();
      expect(rows.length).toBe(2);
    });
  });

  describe('homebrew & override', () => {
    it('createHomebrewRule creates is_homebrew=1 entity', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { createHomebrewRule } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      const result = createHomebrewRule(db, { type: 'spell', title: 'Custom Spell', ruleset: 'homebrew', properties: {} });
      const row = db.prepare(`SELECT is_homebrew FROM rule_entities WHERE id=?`).get(result.id) as { is_homebrew: number };
      expect(row.is_homebrew).toBe(1);
    });

    it('createRuleOverride creates entity with base_entity_id set', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = createRuleOverride(db, { baseEntityId: 'spell-fireball', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT base_entity_id, is_homebrew FROM rule_entities WHERE id=?`).get(override.id) as { base_entity_id: string; is_homebrew: number };
      expect(row.base_entity_id).toBe('spell-fireball');
      expect(row.is_homebrew).toBe(1);
    });
  });

  describe('issue #146: listRuleEntities filter.tag not silently ignored', () => {
    it('listRuleEntities({ tag }) returns only entities with that tag in properties_json', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, listRuleEntities } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, {
        sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '',
        rules: [
          { id: 'spell-fireball', type: 'spell', title: 'Fireball', reference_summary: '', ruleset: 'dnd5e_srd', properties: { tags: ['combat', 'fire'] } },
          { id: 'cond-blinded', type: 'condition', title: 'Blinded', reference_summary: '', ruleset: 'dnd5e_srd', properties: { tags: ['debuff'] } },
        ],
      });
      const result = listRuleEntities(db, { tag: 'combat' });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('spell-fireball');
    });

    it('listRuleEntities({ tag }) returns empty array when no entity has that tag', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, listRuleEntities } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, {
        sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '',
        rules: [srdSpell],
      });
      const result = listRuleEntities(db, { tag: 'nonexistent-tag' });
      expect(result).toEqual([]);
    });
  });

  describe('issue #143: createRuleOverride includes source_id in INSERT', () => {
    it('createRuleOverride accepts source_id and persists it', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = createRuleOverride(db, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT source_id FROM rule_entities WHERE id=?`).get(override.id) as { source_id: string } | undefined;
      expect(row?.source_id).toBe('homebrew');
    });

    it('createRuleOverride without explicit source_id uses sentinel "homebrew"', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      const override = createRuleOverride(db, { baseEntityId: 'spell-fireball', overrides: { title: 'Fireball Plus' } });
      const row = db.prepare(`SELECT source_id FROM rule_entities WHERE id=?`).get(override.id) as { source_id: string } | undefined;
      expect(row?.source_id).toBeTruthy();
    });

    it('two overrides of same base entity can coexist (no PK collision)', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const { importRules, createRuleOverride } = await getRuleImport();
      const db = openDb(); applyRuleSchema(db);
      importRules(db, { sourceId: 'src-srd', sourceLabel: 'SRD', license: 'CC-BY-4.0', url: '', rules: [srdSpell] });
      expect(() => {
        createRuleOverride(db, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball A' } });
        createRuleOverride(db, { baseEntityId: 'spell-fireball', sourceId: 'homebrew', overrides: { title: 'Fireball B' } });
      }).not.toThrow();
    });
  });
});
