import { readEffectiveEntity } from '../../core_data/effective-entity';
import { listCampaignCreatedEntities } from './campaign-override-service';

export type DatabaseLike = {
  execute(sql: string, args?: unknown[]): Promise<void>;
  select<T = Record<string, unknown>>(sql: string, args?: unknown[]): Promise<T[]>;
};

type EntityListItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
};

export async function getEffectiveEntity({ database, entityId }: { database: DatabaseLike; entityId: string }) {
  return readEffectiveEntity({ database, entityId });
}

export async function listEntitiesByType(
  { database, type, campaignId }: { database: DatabaseLike; type: string | null; campaignId?: string },
): Promise<EntityListItem[]> {
  const sql = type === null
    ? 'SELECT id, type, title, summary FROM base_entities ORDER BY title'
    : 'SELECT id, type, title, summary FROM base_entities WHERE type = ? ORDER BY title';

  const rows = type === null
    ? await database.select<EntityListItem>(sql)
    : await database.select<EntityListItem>(sql, [type]);

  const baseItems = rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    summary: String(row.summary),
  }));

  // #415: without a campaign, the list is the world base only (edit mode / world author).
  // Inside a campaign, merge in that campaign's own not-yet-promoted campaign-created
  // entities — they live in overrides, not base, so they surface nowhere else.
  if (!campaignId) return baseItems;
  const created = await listCampaignCreatedEntities(database, campaignId).catch(() => []);
  const createdItems = created
    .filter((c) => type === null || c.type === type)
    .map((c) => ({ id: c.id, type: c.type, title: c.title, summary: c.summary }));
  return [...baseItems, ...createdItems].sort((a, b) => a.title.localeCompare(b.title));
}

export async function updateEntityProperties(
  { database, entityId, properties }: { database: DatabaseLike; entityId: string; properties: Record<string, unknown> },
): Promise<void> {
  await database.execute(`UPDATE base_entities SET properties_json = ? WHERE id = ?`, [
    JSON.stringify(properties),
    entityId,
  ]);
}

/** Permanently deletes an entity row and cascades: every relation where this
 *  entity is source or target goes with it — a dangling relation pointing at
 *  a deleted entity is exactly the orphan this is meant to prevent. */
export async function deleteEntity(database: DatabaseLike, entityId: string): Promise<void> {
  await database.execute(`DELETE FROM relations WHERE source_id = ? OR target_id = ?`, [entityId, entityId]);
  await database.execute(`DELETE FROM base_entities WHERE id = ?`, [entityId]);
}
