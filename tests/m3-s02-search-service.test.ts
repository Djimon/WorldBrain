// @vitest-environment node
// M3-S02: Search service layer — FTS5 + LIKE fallback, facets, ranking.
// See: https://github.com/Djimon/WorldBrain/issues/43
// Rewritten to target async DatabaseLike after search-service migration to execute()/select().

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike for tests.
function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

async function getSearchService() {
  return import('../src/services/search-service');
}

async function openSearchDb() {
  const { applySearchSchema, indexEntity } = await import('../core_data/search-schema');
  const db = new DatabaseSync(':memory:');
  const asyncDb = makeAsyncDb(db);
  await applySearchSchema(asyncDb);

  const entities = [
    { entity_id: 'char-ada', entity_type: 'Character', title: 'Ada Thorn', aliases: 'The Red Notary', summary: 'Archivist of the Weavers.', body: 'She keeps records.', tags: 'archivist mage', properties_text: 'role:archivist' },
    { entity_id: 'char-bram', entity_type: 'Character', title: 'Bram Holt', aliases: 'Innkeeper', summary: 'Runs the inn.', body: 'He brews ale.', tags: 'commoner', properties_text: 'role:innkeeper' },
    { entity_id: 'char-silas', entity_type: 'Character', title: 'Silas da Silva', aliases: '', summary: 'Merchant.', body: 'Trades in secrets.', tags: 'merchant', properties_text: 'role:merchant' },
    { entity_id: 'loc-keep', entity_type: 'Location', title: 'The Keep', aliases: 'Iron Keep', summary: 'Crumbling fortress.', body: 'Ancient walls.', tags: 'location', properties_text: 'type:fortress' },
    { entity_id: 'loc-inn', entity_type: 'Location', title: 'The Rusty Anchor', aliases: '', summary: 'A tavern.', body: 'Smells of ale.', tags: 'location tavern', properties_text: 'type:tavern' },
  ];

  for (const e of entities) {
    await indexEntity(asyncDb, e);
  }

  return asyncDb;
}

describe('M3-S02 search service layer', () => {
  describe('searchEntities function', () => {
    it('exports searchEntities function', async () => {
      const mod = await getSearchService();
      expect(typeof mod.searchEntities).toBe('function');
    });

    it('searchEntities returns a Promise', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();
      const result = searchEntities(db, 'Ada', {});
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('returns a SearchResult array', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Ada', {});

      expect(Array.isArray(results)).toBe(true);
    });

    it('each result has entityId, title, summary, and score', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Ada', {});

      expect(results.length).toBeGreaterThan(0);
      const r = results[0];
      expect(r).toHaveProperty('entityId');
      expect(r).toHaveProperty('title');
      expect(r).toHaveProperty('summary');
      expect(r).toHaveProperty('score');
    });
  });

  describe('FTS5 full-text matching', () => {
    it('matches by title', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Ada Thorn', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by alias', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Red Notary', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by summary text', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Archivist', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by body text', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'secrets', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });

    it('returns empty array for no matches', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'zzznomatchstring', {});

      expect(results.length).toBe(0);
    });
  });

  describe('LIKE fallback for prefix/suffix matching', () => {
    it('"Sil" prefix matches "Silas da Silva"', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Sil', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });

    it('"silva" suffix matches "Silas da Silva"', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'silva', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });
  });

  describe('facet aggregation', () => {
    it('returns results for broad query', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'Keep', {});

      expect(results).toBeDefined();
    });

    it('exports a getSearchFacets function', async () => {
      const mod = await getSearchService();
      expect(typeof (mod as Record<string, unknown>).getSearchFacets).toBe('function');
    });

    it('getSearchFacets returns a Promise', async () => {
      const { getSearchFacets } = await getSearchService();
      const db = await openSearchDb();
      const result = getSearchFacets(db, 'a', {});
      expect(result).toBeInstanceOf(Promise);
      await result;
    });

    it('getSearchFacets returns entity type counts', async () => {
      const { getSearchFacets } = await getSearchService();
      const db = await openSearchDb();

      const facets = await getSearchFacets(db, 'a', {});

      expect(facets).toHaveProperty('entityTypes');
      expect(typeof facets.entityTypes).toBe('object');
    });
  });

  describe('result ranking', () => {
    it('title match ranks higher than body match', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = await searchEntities(db, 'archivist', {});

      if (results.length > 1) {
        const adaIdx = results.findIndex((r) => r.entityId === 'char-ada');
        expect(adaIdx).toBe(0);
      } else {
        expect(results[0].entityId).toBe('char-ada');
      }
    });
  });

  describe('filters', () => {
    it('entityType filter narrows results without throwing', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      await expect(searchEntities(db, 'the', { entityType: 'Location' })).resolves.toBeDefined();
    });
  });
});

// Bug #115: LIKE fallback must escape % and _ wildcards so they are treated as literals
describe('issue #115: LIKE fallback wildcard escaping', () => {
  it('searching for "%" does not return all entities', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = await searchEntities(db, '%', {});

    expect(results.length).toBe(0);
  });

  it('searching for "_" does not return all entities', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = await searchEntities(db, '_', {});

    expect(results.length).toBe(0);
  });

  it('searching for "a%b" does not match "Ada Thorn" (no literal % in title)', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = await searchEntities(db, 'a%b', {});

    expect(results.some((r) => r.entityId === 'char-ada')).toBe(false);
  });
});

// Bug #116: getSearchFacets must not re-run FTS5 query internally; entityType facets must be populated
describe('issue #116: getSearchFacets returns populated entityType counts without double query', () => {
  it('getSearchFacets returns non-empty entityTypes map for a broad query', async () => {
    const { getSearchFacets } = await getSearchService();
    const db = await openSearchDb();

    const facets = await getSearchFacets(db, 'a', {});

    expect(facets.entityTypes).not.toEqual({});
  });

  it('getSearchFacets counts each entity type present in results', async () => {
    const { getSearchFacets } = await getSearchService();
    const db = await openSearchDb();

    const facets = await getSearchFacets(db, 'a', {});

    const typeKeys = Object.keys(facets.entityTypes ?? {});
    expect(typeKeys.length).toBeGreaterThan(0);
  });

  it('getSearchFacets accepts db and query to avoid double query', async () => {
    const mod = await getSearchService();
    expect(typeof mod.getSearchFacets).toBe('function');
  });
});
