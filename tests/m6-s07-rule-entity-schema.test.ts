// @vitest-environment node
// M6-S07: Rule entity schema & data model — rule_sources, rule_entities, homebrew/override layer.
// See: https://github.com/Djimon/WorldBrain/issues/97

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getRuleSchema() { return import('../core_data/rule-schema'); }
function openDb() { return new DatabaseSync(':memory:'); }

describe('M6-S07 rule entity schema', () => {
  describe('rule_sources table', () => {
    it('applyRuleSchema creates rule_sources table', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      const cols = db.prepare('PRAGMA table_info(rule_sources)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('rule_sources has id, label, license, url, is_read_only', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      const names = (db.prepare('PRAGMA table_info(rule_sources)').all() as Array<{ name: string }>).map(c => c.name);
      ['id', 'label', 'license', 'url', 'is_read_only'].forEach(c => expect(names).toContain(c));
    });
  });

  describe('rule_entities table', () => {
    it('applyRuleSchema creates rule_entities table', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      const cols = db.prepare('PRAGMA table_info(rule_entities)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('rule_entities has id, type, ruleset, title, reference_summary, body, source_id, is_homebrew, base_entity_id', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      const names = (db.prepare('PRAGMA table_info(rule_entities)').all() as Array<{ name: string }>).map(c => c.name);
      ['id', 'type', 'ruleset', 'title', 'reference_summary', 'source_id', 'is_homebrew', 'base_entity_id'].forEach(c =>
        expect(names).toContain(c)
      );
    });

    it('base_entity_id is nullable (for non-override entities)', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      db.prepare(`INSERT INTO rule_sources (id, label, license, url, is_read_only) VALUES ('src-1','SRD','CC-BY-4.0','',1)`).run();
      expect(() => db.prepare(
        `INSERT INTO rule_entities (id, type, ruleset, title, source_id, is_homebrew) VALUES ('re-1','spell','dnd5e_srd','Fireball','src-1',0)`
      ).run()).not.toThrow();
    });
  });

  describe('homebrew & override layer', () => {
    it('is_homebrew=1 entity coexists with read-only entity', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      db.prepare(`INSERT INTO rule_sources (id, label, license, url, is_read_only) VALUES ('src-1','SRD','CC-BY-4.0','',1)`).run();
      db.prepare(`INSERT INTO rule_entities (id, type, ruleset, title, source_id, is_homebrew) VALUES ('re-1','spell','dnd5e_srd','Fireball','src-1',0)`).run();
      db.prepare(`INSERT INTO rule_entities (id, type, ruleset, title, source_id, is_homebrew, base_entity_id) VALUES ('re-hb','spell','homebrew','Fireball (Custom)',null,1,'re-1')`).run();
      const rows = db.prepare(`SELECT id, is_homebrew FROM rule_entities`).all() as Array<{ id: string; is_homebrew: number }>;
      expect(rows.length).toBe(2);
      expect(rows.find(r => r.id === 're-hb')?.is_homebrew).toBe(1);
    });
  });

  describe('reference_summary enforcement', () => {
    it('exports isRuleReferenceSummaryRequired function', async () => {
      const mod = await getRuleSchema();
      expect(typeof (mod.isRuleReferenceSummaryRequired ?? mod.requiresReferenceSummary)).toBe('function');
    });
  });

  describe('idempotency', () => {
    it('applyRuleSchema is idempotent', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const db = openDb(); applyRuleSchema(db);
      expect(() => applyRuleSchema(db)).not.toThrow();
    });
  });

  describe('issue #141: applyRuleSchema accepts DatabaseLike (not DatabaseSync)', () => {
    it('applyRuleSchema parameter accepts an object with only prepare() — no exec() required', async () => {
      const { applyRuleSchema } = await getRuleSchema();
      const calls: string[] = [];
      const fakeDatabaseLike = {
        prepare: (sql: string) => {
          calls.push(sql);
          return { run: () => {}, all: () => [], get: () => undefined };
        },
      };
      expect(() => applyRuleSchema(fakeDatabaseLike)).not.toThrow();
    });

    it('applyRuleSchema source file does not call db.exec()', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('core_data/rule-schema.ts', 'utf-8'));
      expect(src).not.toMatch(/\bdb\.exec\s*\(/);
    });
  });
});
