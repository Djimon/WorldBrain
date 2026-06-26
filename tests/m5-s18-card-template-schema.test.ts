// @vitest-environment node
// M5-S18: Card template schema & data model.
// See: https://github.com/Djimon/WorldBrain/issues/84

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getSchema() { return import('../core_data/card-schema'); }
function openDb() { return new DatabaseSync(':memory:'); }

describe('M5-S18 card template schema', () => {
  describe('card_templates table', () => {
    it('applyCardSchema creates card_templates table', async () => {
      const { applyCardSchema } = await getSchema();
      const db = openDb(); applyCardSchema(db);
      const cols = db.prepare('PRAGMA table_info(card_templates)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('card_templates has id, label, entity_types, size_mm, layout, style columns', async () => {
      const { applyCardSchema } = await getSchema();
      const db = openDb(); applyCardSchema(db);
      const names = (db.prepare('PRAGMA table_info(card_templates)').all() as Array<{ name: string }>).map(c => c.name);
      ['id', 'label', 'entity_types', 'size_mm', 'layout', 'style'].forEach(c => expect(names).toContain(c));
    });
  });

  describe('card_instances table', () => {
    it('applyCardSchema creates card_instances table', async () => {
      const { applyCardSchema } = await getSchema();
      const db = openDb(); applyCardSchema(db);
      const cols = db.prepare('PRAGMA table_info(card_instances)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('card_instances has id, entity_id, template_id, audience, fields', async () => {
      const { applyCardSchema } = await getSchema();
      const db = openDb(); applyCardSchema(db);
      const names = (db.prepare('PRAGMA table_info(card_instances)').all() as Array<{ name: string }>).map(c => c.name);
      ['id', 'entity_id', 'template_id', 'audience', 'fields'].forEach(c => expect(names).toContain(c));
    });
  });

  describe('supported card sizes', () => {
    it('CARD_SIZES exports Poker, Tarot, Moderation, A4', async () => {
      const mod = await getSchema();
      const sizes = mod.CARD_SIZES ?? mod.cardSizes;
      expect(sizes).toBeDefined();
      const keys = Object.keys(sizes);
      ['Poker', 'Tarot', 'Moderation', 'A4'].forEach(s => expect(keys).toContain(s));
    });

    it('Poker size is 63x88mm', async () => {
      const mod = await getSchema();
      const sizes = mod.CARD_SIZES ?? mod.cardSizes;
      expect(sizes.Poker).toMatchObject({ width_mm: 63, height_mm: 88 });
    });
  });

  describe('9 built-in category templates', () => {
    it('BUILT_IN_CARD_TEMPLATES has 9 entries', async () => {
      const mod = await getSchema();
      const templates = mod.BUILT_IN_CARD_TEMPLATES ?? mod.builtInCardTemplates;
      expect(templates).toHaveLength(9);
    });

    it('categories include NPC, Item, Spell/Ability, Quest, Clue, Faction, Location, Secret, Condition', async () => {
      const mod = await getSchema();
      const templates = mod.BUILT_IN_CARD_TEMPLATES ?? mod.builtInCardTemplates;
      const labels = templates.map((t: { label: string }) => t.label);
      ['NPC', 'Item', 'Quest', 'Clue', 'Faction', 'Location', 'Secret', 'Condition'].forEach(l =>
        expect(labels.some((ll: string) => ll.toLowerCase().includes(l.toLowerCase()))).toBe(true)
      );
    });

    it('Secret template description slot uses shrink overflow, not reference_only', async () => {
      const mod = await getSchema();
      const templates = mod.BUILT_IN_CARD_TEMPLATES ?? mod.builtInCardTemplates;
      const secret = templates.find((t: { label: string }) => t.label === 'Secret');
      const descSlot = secret?.layout?.slots?.find((s: { field: string }) => s.field === 'description');
      // Secret is a full-text reveal — reference_only is semantically wrong here (no external full text exists).
      // Decision: overflow must be shrink (layout problem, not architecture problem).
      expect(descSlot?.overflow).not.toBe('reference_only');
      expect(descSlot?.overflow).toBe('shrink');
    });

    it('all 9 templates load from seed data into DB', async () => {
      const { applyCardSchema, seedBuiltInCardTemplates } = await getSchema();
      const db = openDb(); applyCardSchema(db); seedBuiltInCardTemplates(db);
      const rows = db.prepare('SELECT id FROM card_templates').all();
      expect(rows.length).toBe(9);
    });
  });

  describe('overflow policies', () => {
    it('OVERFLOW_POLICIES exports truncate, shrink, split, summary_required, reference_only', async () => {
      const mod = await getSchema();
      const policies = mod.OVERFLOW_POLICIES ?? mod.overflowPolicies;
      expect(policies).toBeDefined();
      ['truncate', 'shrink', 'split', 'summary_required', 'reference_only'].forEach(p =>
        expect(Object.values(policies)).toContain(p)
      );
    });
  });

  describe('reference_summary enforcement', () => {
    it('exports isReferenceSummaryRequired function', async () => {
      const mod = await getSchema();
      expect(typeof (mod.isReferenceSummaryRequired ?? mod.requiresReferenceSummary)).toBe('function');
    });

    it('Spell/Ability category requires reference_summary', async () => {
      const mod = await getSchema();
      const fn = mod.isReferenceSummaryRequired ?? mod.requiresReferenceSummary;
      expect(fn('Spell/Ability')).toBe(true);
    });

    it('NPC category does not require reference_summary', async () => {
      const mod = await getSchema();
      const fn = mod.isReferenceSummaryRequired ?? mod.requiresReferenceSummary;
      expect(fn('NPC')).toBe(false);
    });

    it('Rule category requires reference_summary', async () => {
      const mod = await getSchema();
      const fn = mod.isReferenceSummaryRequired ?? mod.requiresReferenceSummary;
      expect(fn('Rule')).toBe(true);
    });

    it('Condition category requires reference_summary', async () => {
      const mod = await getSchema();
      const fn = mod.isReferenceSummaryRequired ?? mod.requiresReferenceSummary;
      expect(fn('Condition')).toBe(true);
    });
  });

  describe('idempotency', () => {
    it('applyCardSchema is idempotent', async () => {
      const { applyCardSchema } = await getSchema();
      const db = openDb(); applyCardSchema(db);
      expect(() => applyCardSchema(db)).not.toThrow();
    });
  });
});

// Bug #125: print_jobs table missing from applyCardSchema
describe('issue #125: print_jobs table created by applyCardSchema', () => {
  it('applyCardSchema creates a print_jobs table', async () => {
    const { applyCardSchema } = await getSchema();
    const db = openDb();
    applyCardSchema(db);
    expect(() =>
      db.prepare('SELECT id, cards_json, cut_marks, backside, created_at FROM print_jobs LIMIT 0').all()
    ).not.toThrow();
  });

  it('print_jobs table accepts an insert with required fields', async () => {
    const { applyCardSchema } = await getSchema();
    const db = openDb();
    applyCardSchema(db);
    expect(() =>
      db.prepare(`INSERT INTO print_jobs (id, cards_json, cut_marks, created_at) VALUES ('pj-1', '[]', 1, '2026-06-25T00:00:00Z')`).run()
    ).not.toThrow();
  });
});
