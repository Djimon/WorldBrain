import { readEffectiveEntity } from '../../core_data/effective-entity';

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

export async function listEntitiesByType({ database, type }: { database: DatabaseLike; type: string | null }): Promise<EntityListItem[]> {
  const sql = type === null
    ? 'SELECT id, type, title, summary FROM base_entities ORDER BY title'
    : 'SELECT id, type, title, summary FROM base_entities WHERE type = ? ORDER BY title';

  const rows = type === null
    ? await database.select<EntityListItem>(sql)
    : await database.select<EntityListItem>(sql, [type]);

  return rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    summary: String(row.summary),
  }));
}

export async function updateEntityProperties(
  { database, entityId, properties }: { database: DatabaseLike; entityId: string; properties: Record<string, unknown> },
): Promise<void> {
  await database.execute(`UPDATE base_entities SET properties_json = ? WHERE id = ?`, [
    JSON.stringify(properties),
    entityId,
  ]);
}
