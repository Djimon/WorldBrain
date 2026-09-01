// @vitest-environment node
// M2-S10: Relation service layer — CRUD, deactivate/reactivate, campaign log.
// See: https://github.com/Djimon/WorldBrain/issues/38

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getRelationService() {
  return import('../src/services/relation-service');
}

// Async DatabaseLike wrapper around the sync in-memory node:sqlite handle,
// plus a `prepare` passthrough so the raw assertions below keep working.
function makeDb() {
  const raw = new DatabaseSync(':memory:');
  return {
    execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
    select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
      raw.prepare(sql).all(...(args as never[])) as T[],
    prepare: (sql: string) => raw.prepare(sql),
  };
}

async function openPopulatedDb() {
  const { applyRelationsSchema } = await import('../core_data/relations-schema');
  const db = makeDb();
  await applyRelationsSchema(db);
  return db;
}

describe('M2-S10 relation service layer', () => {
  describe('addRelation', () => {
    it('creates a new relation row', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      const rows = db.prepare('SELECT * FROM relations').all() as unknown[];
      expect(rows.length).toBe(1);
    });

    it('new relation is active=true by default', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      const row = db.prepare('SELECT active FROM relations LIMIT 1').get() as { active: number };
      expect(row.active).toBe(1);
    });

    it('writes a campaign_relation_log entry with event "added"', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      const log = db.prepare('SELECT * FROM campaign_relation_log').all() as Array<{ event: string }>;
      expect(log.length).toBe(1);
      expect(log[0].event).toBe('added');
    });

    it('stores optional notes when provided', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
        notes: 'Met during the siege.',
      });

      const row = db.prepare('SELECT notes FROM relations LIMIT 1').get() as { notes: string };
      expect(row.notes).toBe('Met during the siege.');
    });

    it('returns the created relation id', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const result = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });
  });

  describe('getRelations', () => {
    it('returns relations where entity is the source', async () => {
      const { addRelation, getRelations } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'knows_secret',
        visibility: 'public',
      });

      const relations = await getRelations(db, 'entity-ada', { includeInactive: false });
      expect(relations.length).toBe(1);
    });

    it('returns relations where entity is the target', async () => {
      const { addRelation, getRelations } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ranks_above',
        visibility: 'public',
      });

      const relations = await getRelations(db, 'entity-bram', { includeInactive: false });
      expect(relations.length).toBe(1);
    });

    it('excludes inactive relations by default', async () => {
      const { addRelation, deactivateRelation, getRelations } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });
      await deactivateRelation(db, id);

      const relations = await getRelations(db, 'entity-ada', { includeInactive: false });
      expect(relations.length).toBe(0);
    });

    it('includes inactive relations when includeInactive=true', async () => {
      const { addRelation, deactivateRelation, getRelations } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });
      await deactivateRelation(db, id);

      const relations = await getRelations(db, 'entity-ada', { includeInactive: true });
      expect(relations.length).toBe(1);
    });
  });

  describe('deactivateRelation', () => {
    it('sets active=false', async () => {
      const { addRelation, deactivateRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      await deactivateRelation(db, id);

      const row = db.prepare('SELECT active FROM relations WHERE id = ?').get(id) as { active: number };
      expect(row.active).toBe(0);
    });

    it('writes a campaign_relation_log entry with event "removed"', async () => {
      const { addRelation, deactivateRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      await deactivateRelation(db, id);

      const log = db.prepare('SELECT event FROM campaign_relation_log ORDER BY rowid DESC LIMIT 1').get() as { event: string };
      expect(log.event).toBe('removed');
    });

    it('preserves notes when deactivated', async () => {
      const { addRelation, deactivateRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
        notes: 'Old alliance.',
      });

      await deactivateRelation(db, id);

      const row = db.prepare('SELECT notes FROM relations WHERE id = ?').get(id) as { notes: string };
      expect(row.notes).toBe('Old alliance.');
    });
  });

  describe('reactivateRelation', () => {
    it('sets active=true', async () => {
      const { addRelation, deactivateRelation, reactivateRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });
      await deactivateRelation(db, id);
      await reactivateRelation(db, id);

      const row = db.prepare('SELECT active FROM relations WHERE id = ?').get(id) as { active: number };
      expect(row.active).toBe(1);
    });

    it('writes a campaign_relation_log entry with event "added"', async () => {
      const { addRelation, deactivateRelation, reactivateRelation } = await getRelationService();
      const db = await openPopulatedDb();

      const { id } = await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });
      await deactivateRelation(db, id);
      await reactivateRelation(db, id);

      const log = db.prepare('SELECT event FROM campaign_relation_log ORDER BY rowid DESC LIMIT 1').get() as { event: string };
      expect(log.event).toBe('added');
    });
  });

  describe('symmetric type handling', () => {
    it('getRelations returns the relation from both source and target perspective', async () => {
      const { addRelation, getRelations } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      const fromAdaPerspective = await getRelations(db, 'entity-ada', { includeInactive: false });
      const fromBramPerspective = await getRelations(db, 'entity-bram', { includeInactive: false });

      expect(fromAdaPerspective.length).toBe(1);
      expect(fromBramPerspective.length).toBe(1);
    });

    it('inverse relation is derived, not stored as a second row', async () => {
      const { addRelation } = await getRelationService();
      const db = await openPopulatedDb();

      await addRelation(db, {
        source_id: 'entity-ada',
        target_id: 'entity-bram',
        relation_type: 'ally_of',
        visibility: 'public',
      });

      const rows = db.prepare('SELECT COUNT(*) as cnt FROM relations').get() as { cnt: number };
      // Only one row stored — inverse is derived at query time
      expect(rows.cnt).toBe(1);
    });
  });
});

// Bug #61
describe('issue-61 relation ID collision safety', () => {
  describe('source-level: no Math.random for ID generation', () => {
    it('relation-service.ts does not use Math.random() for IDs', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      // Math.random may appear in tests or comments, but not as the ID generator
      // The randomId() function (or equivalent) must not use Math.random
      expect(src).not.toMatch(/Math\.random\(\)\.toString/);
    });

    it('relation-service.ts uses crypto.randomUUID or ULID for ID generation', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      const usesCrypto = src.includes('crypto.randomUUID') || src.includes('randomUUID');
      const usesUlid = src.toLowerCase().includes('ulid');
      expect(usesCrypto || usesUlid).toBe(true);
    });
  });

  describe('runtime: generated IDs are unique and have rel_ prefix', () => {
    async function addTwoRelations() {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation } = await import('../src/services/relation-service');
      const db = makeDb();
      await applyRelationsSchema(db);

      const r1 = await addRelation(db, { source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', visibility: 'public' });
      const r2 = await addRelation(db, { source_id: 'e1', target_id: 'e3', relation_type: 'ally_of', visibility: 'public' });
      return { r1, r2 };
    }

    it('two relation IDs are not equal', async () => {
      const { r1, r2 } = await addTwoRelations();
      expect(r1.id).not.toBe(r2.id);
    });

    it('relation ID has rel_ prefix', async () => {
      const { r1 } = await addTwoRelations();
      expect(r1.id).toMatch(/^rel_/);
    });

    it('relation ID is a non-empty string of at least 20 chars', async () => {
      const { r1 } = await addTwoRelations();
      expect(r1.id.length).toBeGreaterThanOrEqual(20);
    });

    it('100 generated IDs are all unique', async () => {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation } = await import('../src/services/relation-service');
      const db = makeDb();
      await applyRelationsSchema(db);

      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const { id } = await addRelation(db, { source_id: `e${i}`, target_id: 'e-target', relation_type: 'ally_of', visibility: 'public' });
        ids.add(id);
      }

      expect(ids.size).toBe(100);
    });
  });
});

