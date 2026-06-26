import type { DatabaseLike } from './entity-service';

export interface SearchResult {
  entityId: string;
  title: string;
  summary: string;
  score: number;
  entityType?: string;
}

export interface SearchFilters {
  entityType?: string;
}

export interface SearchFacets {
  entityTypes: Record<string, number>;
}

export async function rebuildSearchIndex(db: DatabaseLike): Promise<void> {
  await db.execute(`DELETE FROM entity_search`);
  const rows = await db.select<{ id: string; type: string; title: string; summary: string; aliases_json: string; body_json: string }>(
    `SELECT id, type, title, summary, aliases_json, body_json FROM base_entities`,
  );
  for (const row of rows) {
    await db.execute(
      `INSERT INTO entity_search (entity_id, entity_type, title, aliases, summary, body) VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.type, row.title, row.aliases_json ?? '[]', row.summary ?? '', row.body_json ?? ''],
    );
  }
}

export async function searchEntities(db: DatabaseLike, query: string, _filters: SearchFilters): Promise<SearchResult[]> {
  if (!query || !query.trim()) return [];

  const trimmed = query.trim();
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // FTS5 match with prefix wildcard — skip terms containing literal wildcards
  try {
    const ftsTerms = trimmed
      .split(/\s+/)
      .filter((w) => !/[%_]/.test(w))
      .map((w) => w.replace(/['"*]/g, '') + '*');
    const ftsQuery = ftsTerms.join(' ');
    if (!ftsQuery) throw new Error('empty fts query');
    const rows = await db.select<{ entity_id: string; entity_type: string; title: string; summary: string; score: number }>(
      `SELECT entity_id, entity_type, title, summary, bm25(entity_search) as score
       FROM entity_search
       WHERE entity_search MATCH ?
       ORDER BY bm25(entity_search)`,
      [ftsQuery],
    );
    for (const r of rows) {
      if (!seen.has(r.entity_id)) {
        seen.add(r.entity_id);
        results.push({ entityId: r.entity_id, entityType: r.entity_type || undefined, title: r.title, summary: r.summary ?? '', score: r.score });
      }
    }
  } catch { /* FTS5 query error — fall through to LIKE */ }

  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const like = `%${escaped}%`;
  const likeRows = await db.select<{ entity_id: string; entity_type: string; title: string; summary: string }>(
    `SELECT entity_id, entity_type, title, summary
     FROM entity_search
     WHERE title LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\'`,
    [like, like, like, like],
  );
  for (const r of likeRows) {
    if (!seen.has(r.entity_id)) {
      seen.add(r.entity_id);
      results.push({ entityId: r.entity_id, entityType: r.entity_type || undefined, title: r.title, summary: r.summary ?? '', score: -1 });
    }
  }

  return results;
}

export async function getSearchFacets(
  db: DatabaseLike,
  query: string,
  filters: SearchFilters,
  precomputedResults?: SearchResult[],
): Promise<SearchFacets> {
  const results = precomputedResults ?? await searchEntities(db, query, filters);
  const entityTypes: Record<string, number> = {};
  for (const r of results) {
    const t = r.entityType ?? '';
    entityTypes[t] = (entityTypes[t] ?? 0) + 1;
  }
  return { entityTypes };
}
