import type { DatabaseLike } from './entity-service';

export interface SearchResult {
  entityId: string;
  title: string;
  summary: string;
  score: number;
  entityType?: string;
  /** #419: set when the hit is a campaign-created entity — the id of its owning campaign
   *  (empty/undefined = world base). Lets the UI mark "belongs to campaign X". */
  campaignId?: string;
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
      `INSERT INTO entity_search (entity_id, entity_type, title, aliases, summary, body, campaign_id) VALUES (?, ?, ?, ?, ?, ?, '')`,
      [row.id, row.type, row.title, row.aliases_json ?? '[]', row.summary ?? '', row.body_json ?? ''],
    );
  }
  // #419: index campaign-created entities (host/DM side) scoped by their owning campaign.
  // Not-yet-promoted only — a promoted one is already a base row above. Guarded so DBs
  // without the column/table don't break the base index.
  const created = await db.select<{ campaign_id: string; entity_id: string; patch_json: string }>(
    `SELECT campaign_id, entity_id, patch_json FROM campaign_entity_overrides WHERE campaign_created = 1 AND promoted_at IS NULL`,
  ).catch(() => [] as { campaign_id: string; entity_id: string; patch_json: string }[]);
  for (const c of created) {
    const e = JSON.parse(c.patch_json) as Record<string, unknown>;
    await db.execute(
      `INSERT INTO entity_search (entity_id, entity_type, title, aliases, summary, body, campaign_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        c.entity_id,
        String(e.type ?? ''),
        String(e.title ?? ''),
        JSON.stringify(e.aliases ?? []),
        String(e.summary ?? ''),
        JSON.stringify(e.body ?? { format: 'portable_blocks_v1', blocks: [] }),
        c.campaign_id,
      ],
    );
  }
}

export async function searchEntities(
  db: DatabaseLike,
  query: string,
  _filters: SearchFilters,
  campaignId?: string,
): Promise<SearchResult[]> {
  if (!query || !query.trim()) return [];

  const trimmed = query.trim();
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // #419: world rows (campaign_id = '') are always visible; when in a campaign, that
  // campaign's own campaign-created rows are added. Outside a campaign → world only.
  const campaignClause = campaignId
    ? `(campaign_id = '' OR campaign_id = ?)`
    : `campaign_id = ''`;
  const campaignArgs = campaignId ? [campaignId] : [];

  // FTS5 match with prefix wildcard — skip terms containing literal wildcards
  try {
    const ftsTerms = trimmed
      .split(/\s+/)
      .filter((w) => !/[%_]/.test(w))
      .map((w) => w.replace(/['"*]/g, '') + '*');
    const ftsQuery = ftsTerms.join(' ');
    if (!ftsQuery) throw new Error('empty fts query');
    const rows = await db.select<{ entity_id: string; entity_type: string; title: string; summary: string; campaign_id: string; score: number }>(
      `SELECT entity_id, entity_type, title, summary, campaign_id, bm25(entity_search) as score
       FROM entity_search
       WHERE entity_search MATCH ? AND ${campaignClause}
       ORDER BY bm25(entity_search)`,
      [ftsQuery, ...campaignArgs],
    );
    for (const r of rows) {
      if (!seen.has(r.entity_id)) {
        seen.add(r.entity_id);
        results.push({ entityId: r.entity_id, entityType: r.entity_type || undefined, title: r.title, summary: r.summary ?? '', score: r.score, campaignId: r.campaign_id || undefined });
      }
    }
  } catch { /* FTS5 query error — fall through to LIKE */ }

  const escaped = trimmed.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  const like = `%${escaped}%`;
  const likeRows = await db.select<{ entity_id: string; entity_type: string; title: string; summary: string; campaign_id: string }>(
    `SELECT entity_id, entity_type, title, summary, campaign_id
     FROM entity_search
     WHERE (title LIKE ? ESCAPE '\\' OR aliases LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') AND ${campaignClause}`,
    [like, like, like, like, ...campaignArgs],
  );
  for (const r of likeRows) {
    if (!seen.has(r.entity_id)) {
      seen.add(r.entity_id);
      results.push({ entityId: r.entity_id, entityType: r.entity_type || undefined, title: r.title, summary: r.summary ?? '', score: -1, campaignId: r.campaign_id || undefined });
    }
  }

  return results;
}

export async function getSearchFacets(
  db: DatabaseLike,
  query: string,
  filters: SearchFilters,
  precomputedResults?: SearchResult[],
  campaignId?: string,
): Promise<SearchFacets> {
  const results = precomputedResults ?? await searchEntities(db, query, filters, campaignId);
  const entityTypes: Record<string, number> = {};
  for (const r of results) {
    const t = r.entityType ?? '';
    entityTypes[t] = (entityTypes[t] ?? 0) + 1;
  }
  return { entityTypes };
}
