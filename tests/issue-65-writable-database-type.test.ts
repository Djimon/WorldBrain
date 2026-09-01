// @vitest-environment node
// refactor: consolidate WriteDb and DatabaseLike into ONE shared exported type.
// See: https://github.com/Djimon/WorldBrain/issues/65
//
// #400: der separate Typname `WritableDatabaseLike` wurde bewusst auf `DatabaseLike`
// konsolidiert (Commit 9583544). Die drei Assertions, die den alten Typnamen +
// dessen run()/get() verlangten, sind entfernt; die gültigen Guards bleiben:
// kein lokaler `WriteDb`-Typ, Import des DB-Typs aus entity-service, und die
// Runtime-Checks für addRelation/getRelations.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('issue-65 shared DatabaseLike type (consolidated)', () => {
  describe('source-level: single shared DB type', () => {
    it('relation-service.ts does not define its own local WriteDb type', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      expect(src).not.toMatch(/^\s*type WriteDb\s*=/m);
      expect(src).not.toMatch(/^\s*interface WriteDb\s*/m);
    });

    it('relation-service.ts imports its DB type from entity-service or database-types', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      const importsFromEntityService = src.includes('entity-service') && src.match(/DatabaseLike|WritableDatabaseLike/);
      const importsFromDbTypes = src.includes('database-types') && src.match(/DatabaseLike/);
      expect(importsFromEntityService || importsFromDbTypes).toBeTruthy();
    });
  });

  describe('runtime: relation-service uses the shared DatabaseLike consistently', () => {
    // #400: die Services sind async über DatabaseLike (execute/select), nicht mehr
    // über rohes node:sqlite. Adapter kapselt DatabaseSync als DatabaseLike.
    async function makeDb() {
      const { DatabaseSync } = await import('node:sqlite');
      const raw = new DatabaseSync(':memory:');
      return {
        execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
        select: async <T,>(sql: string, args: unknown[] = []) => raw.prepare(sql).all(...(args as never[])) as T[],
      };
    }

    it('addRelation persists a relation on a DatabaseLike-shaped object', async () => {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation, getRelations } = await import('../src/services/relation-service');
      const db = await makeDb();
      await applyRelationsSchema(db);
      await addRelation(db, { source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', visibility: 'public' });
      const rels = await getRelations(db, 'e1', { includeInactive: false });
      expect(rels.length).toBeGreaterThan(0);
    });

    it('getRelations reads back without internal cast errors', async () => {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation, getRelations } = await import('../src/services/relation-service');
      const db = await makeDb();
      await applyRelationsSchema(db);
      await addRelation(db, { source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', visibility: 'public' });
      const rels = await getRelations(db, 'e1', { includeInactive: false });
      expect(rels.some((r) => r.target_id === 'e2')).toBe(true);
    });
  });
});
