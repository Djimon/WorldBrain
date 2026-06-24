// @vitest-environment node
// refactor: consolidate WriteDb and DatabaseLike into shared exported type.
// See: https://github.com/Djimon/WorldBrain/issues/65

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('issue-65 WritableDatabaseLike shared type', () => {
  describe('source-level: single shared DB type', () => {
    it('entity-service.ts or database-types.ts exports WritableDatabaseLike', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const candidates = [
        'src/services/entity-service.ts',
        'src/services/database-types.ts',
      ];

      let found = false;
      for (const c of candidates) {
        if (fs.existsSync(path.resolve(c))) {
          const src = fs.readFileSync(path.resolve(c), 'utf-8');
          if (src.match(/export\s+(type\s+)?WritableDatabaseLike/)) {
            found = true;
            break;
          }
        }
      }

      expect(found, 'No file exports WritableDatabaseLike').toBe(true);
    });

    it('relation-service.ts does not define its own local WriteDb type', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      expect(src).not.toMatch(/^\s*type WriteDb\s*=/m);
      expect(src).not.toMatch(/^\s*interface WriteDb\s*/m);
    });

    it('relation-service.ts imports its DB type from entity-service or database-types', () => {
      const src = readFileSync('src/services/relation-service.ts', 'utf-8');
      const importsFromEntityService = src.includes('entity-service') && src.match(/DatabaseLike|WritableDatabaseLike/);
      const importsFromDbTypes = src.includes('database-types') && src.match(/DatabaseLike|WritableDatabaseLike/);
      expect(importsFromEntityService || importsFromDbTypes).toBeTruthy();
    });

    it('WritableDatabaseLike includes .run() capability (extends DatabaseLike)', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const candidates = [
        'src/services/entity-service.ts',
        'src/services/database-types.ts',
      ];

      let src = '';
      for (const c of candidates) {
        if (fs.existsSync(path.resolve(c))) {
          const content = fs.readFileSync(path.resolve(c), 'utf-8');
          if (content.match(/WritableDatabaseLike/)) { src = content; break; }
        }
      }

      // WritableDatabaseLike must include prepare().run() in its type definition
      expect(src).toMatch(/run\s*\(/);
    });

    it('WritableDatabaseLike includes .get() capability', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const candidates = [
        'src/services/entity-service.ts',
        'src/services/database-types.ts',
      ];

      let src = '';
      for (const c of candidates) {
        if (fs.existsSync(path.resolve(c))) {
          const content = fs.readFileSync(path.resolve(c), 'utf-8');
          if (content.match(/WritableDatabaseLike/)) { src = content; break; }
        }
      }

      expect(src).toMatch(/get\s*\(/);
    });
  });

  describe('runtime: relation-service uses the shared type consistently', () => {
    it('addRelation accepts a WritableDatabaseLike-shaped object', async () => {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation } = await import('../src/services/relation-service');
      const { DatabaseSync } = await import('node:sqlite');

      const db = new DatabaseSync(':memory:');
      applyRelationsSchema(db);

      expect(() =>
        addRelation(db, { source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', visibility: 'public' }),
      ).not.toThrow();
    });

    it('getRelations accepts a WritableDatabaseLike-shaped object without internal cast errors', async () => {
      const { applyRelationsSchema } = await import('../core_data/relations-schema');
      const { addRelation, getRelations } = await import('../src/services/relation-service');
      const { DatabaseSync } = await import('node:sqlite');

      const db = new DatabaseSync(':memory:');
      applyRelationsSchema(db);
      addRelation(db, { source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', visibility: 'public' });

      expect(() => getRelations(db, 'e1', { includeInactive: false })).not.toThrow();
    });
  });
});
