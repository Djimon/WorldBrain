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

export function searchEntities(
  db: DatabaseLike,
  query: string,
  _filters: SearchFilters,
): SearchResult[] {
  if (!query || !query.trim()) return [];

  const trimmed = query.trim();
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // FTS5 match with prefix wildcard
  try {
    const ftsQuery = trimmed
      .split(/\s+/)
      .map((w) => w.replace(/['"*]/g, '') + '*')
      .join(' ');
    const rows = db
      .prepare(
        `SELECT entity_id, title, summary, bm25(entity_search) as score
         FROM entity_search
         WHERE entity_search MATCH ?
         ORDER BY bm25(entity_search)`,
      )
      .all(ftsQuery) as Array<{ entity_id: string; title: string; summary: string; score: number }>;
    for (const r of rows) {
      if (!seen.has(r.entity_id)) {
        seen.add(r.entity_id);
        results.push({ entityId: r.entity_id, title: r.title, summary: r.summary ?? '', score: r.score });
      }
    }
  } catch { /* FTS5 query error — fall through to LIKE */ }

  // LIKE fallback for substring/suffix matches not caught by FTS5
  try {
    const like = `%${trimmed}%`;
    const rows = db
      .prepare(
        `SELECT entity_id, title, summary
         FROM entity_search
         WHERE title LIKE ? OR aliases LIKE ? OR summary LIKE ? OR body LIKE ?`,
      )
      .all(like, like, like, like) as Array<{ entity_id: string; title: string; summary: string }>;
    for (const r of rows) {
      if (!seen.has(r.entity_id)) {
        seen.add(r.entity_id);
        results.push({ entityId: r.entity_id, title: r.title, summary: r.summary ?? '', score: -1 });
      }
    }
  } catch { /* */ }

  return results;
}

export function getSearchFacets(
  db: DatabaseLike,
  query: string,
  filters: SearchFilters,
): SearchFacets {
  const results = searchEntities(db, query, filters);
  const entityTypes: Record<string, number> = {};
  for (const r of results) {
    if (r.entityType) {
      entityTypes[r.entityType] = (entityTypes[r.entityType] ?? 0) + 1;
    }
  }
  return { entityTypes };
}
