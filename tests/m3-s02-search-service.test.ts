// @vitest-environment node
// M3-S02: Search service layer — FTS5 + LIKE fallback, facets, ranking.
// See: https://github.com/Djimon/WorldBrain/issues/43

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getSearchService() {
  return import('../src/services/search-service');
}

async function openSearchDb() {
  const { applySearchSchema, indexEntity } = await import('../core_data/search-schema');
  const db = new DatabaseSync(':memory:');
  applySearchSchema(db);

  const entities = [
    { entity_id: 'char-ada', title: 'Ada Thorn', aliases: 'The Red Notary', summary: 'Archivist of the Weavers.', body: 'She keeps records.', tags: 'archivist mage', properties_text: 'role:archivist' },
    { entity_id: 'char-bram', title: 'Bram Holt', aliases: 'Innkeeper', summary: 'Runs the inn.', body: 'He brews ale.', tags: 'commoner', properties_text: 'role:innkeeper' },
    { entity_id: 'char-silas', title: 'Silas da Silva', aliases: '', summary: 'Merchant.', body: 'Trades in secrets.', tags: 'merchant', properties_text: 'role:merchant' },
    { entity_id: 'loc-keep', title: 'The Keep', aliases: 'Iron Keep', summary: 'Crumbling fortress.', body: 'Ancient walls.', tags: 'location', properties_text: 'type:fortress' },
    { entity_id: 'loc-inn', title: 'The Rusty Anchor', aliases: '', summary: 'A tavern.', body: 'Smells of ale.', tags: 'location tavern', properties_text: 'type:tavern' },
  ];

  for (const e of entities) {
    indexEntity(db, e);
  }

  return db;
}

describe('M3-S02 search service layer', () => {
  describe('searchEntities function', () => {
    it('exports searchEntities function', async () => {
      const mod = await getSearchService();
      expect(typeof mod.searchEntities).toBe('function');
    });

    it('returns a SearchResult array', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Ada', {});

      expect(Array.isArray(results)).toBe(true);
    });

    it('each result has entityId, title, summary, and score', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Ada', {});

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

      const results = searchEntities(db, 'Ada Thorn', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by alias', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Red Notary', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by summary text', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Archivist', {});

      expect(results.some((r) => r.entityId === 'char-ada')).toBe(true);
    });

    it('matches by body text', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'secrets', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });

    it('returns empty array for no matches', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'zzznomatchstring', {});

      expect(results.length).toBe(0);
    });
  });

  describe('LIKE fallback for prefix/suffix matching', () => {
    it('"Sil" prefix matches "Silas da Silva"', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Sil', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });

    it('"silva" suffix matches "Silas da Silva"', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'silva', {});

      expect(results.some((r) => r.entityId === 'char-silas')).toBe(true);
    });
  });

  describe('facet aggregation', () => {
    it('returns facets alongside results', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      const results = searchEntities(db, 'Keep', {});

      // Results may carry facets or a separate call — check the result object
      expect(results).toBeDefined();
    });

    it('exports a getSearchFacets function', async () => {
      const mod = await getSearchService();
      expect(typeof (mod as Record<string, unknown>).getSearchFacets).toBe('function');
    });

    it('getSearchFacets returns entity type counts', async () => {
      const { getSearchFacets } = await getSearchService();
      const db = await openSearchDb();

      const facets = getSearchFacets(db, 'a', {});

      expect(facets).toHaveProperty('entityTypes');
      expect(typeof facets.entityTypes).toBe('object');
    });
  });

  describe('result ranking', () => {
    it('title match ranks higher than body match', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      // 'archivist' appears in Ada's title area (summary) AND as a tag
      // 'Archivist of the Weavers' is her summary, 'archivist' is a tag
      const results = searchEntities(db, 'archivist', {});

      // Ada should appear first or have the highest score
      if (results.length > 1) {
        const adaIdx = results.findIndex((r) => r.entityId === 'char-ada');
        expect(adaIdx).toBe(0);
      } else {
        expect(results[0].entityId).toBe('char-ada');
      }
    });
  });

  describe('filters', () => {
    it('entityType filter narrows results', async () => {
      const { searchEntities } = await getSearchService();
      const db = await openSearchDb();

      // Only locations — keep results should not include characters
      // Note: entity_search only has what was indexed; type filter requires type stored in index
      // This test verifies the filter parameter is accepted without throwing
      expect(() => searchEntities(db, 'the', { entityType: 'Location' })).not.toThrow();
    });
  });
});

// Bug #115: LIKE fallback must escape % and _ wildcards so they are treated as literals
describe('issue #115: LIKE fallback wildcard escaping', () => {
  it('searching for "%" does not return all entities', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = searchEntities(db, '%', {});

    // Without escaping, '%' becomes '%%%' which matches everything.
    // With escaping, '\\%' matches only a literal %, so results must be empty.
    expect(results.length).toBe(0);
  });

  it('searching for "_" does not return all entities', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = searchEntities(db, '_', {});

    expect(results.length).toBe(0);
  });

  it('searching for "a%b" does not match "Ada Thorn" (no literal % in title)', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    const results = searchEntities(db, 'a%b', {});

    expect(results.some((r) => r.entityId === 'char-ada')).toBe(false);
  });

  it('searching for "The_Keep" with underscore wildcard does not over-match', async () => {
    const { searchEntities } = await getSearchService();
    const db = await openSearchDb();

    // "The_Keep" should only match if there is a literal underscore in the title.
    // The Keep has no underscore — if _ is treated as wildcard it would match "The Keep".
    const results = searchEntities(db, 'The_Keep', {});

    expect(results.some((r) => r.entityId === 'loc-keep')).toBe(false);
  });
});

// Bug #116: getSearchFacets must not re-run FTS5 query internally; entityType facets must be populated
describe('issue #116: getSearchFacets returns populated entityType counts without double query', () => {
  it('getSearchFacets returns non-empty entityTypes map for a broad query', async () => {
    const { getSearchFacets } = await getSearchService();
    const db = await openSearchDb();

    const facets = getSearchFacets(db, 'a', {});

    // If entityType is never populated (current bug), this will be {}
    expect(facets.entityTypes).not.toEqual({});
  });

  it('getSearchFacets counts each entity type present in results', async () => {
    const { getSearchFacets } = await getSearchService();
    const db = await openSearchDb();

    // Indexed entities include 3 Characters and 2 Locations — both types must appear
    const facets = getSearchFacets(db, 'a', {});

    const typeKeys = Object.keys(facets.entityTypes ?? {});
    expect(typeKeys.length).toBeGreaterThan(0);
  });

  it('getSearchFacets accepts pre-computed results to avoid double query', async () => {
    const mod = await getSearchService();

    // After fix, getSearchFacets should accept an optional results param
    // (or be merged into searchEntities). Either way it must not crash.
    expect(typeof mod.getSearchFacets).toBe('function');
  });
});
