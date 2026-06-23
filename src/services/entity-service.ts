import { readEffectiveEntity } from '../../core_data/effective-entity';

export type DatabaseLike = {
  prepare: (sql: string) => { all: (...args: unknown[]) => Array<Record<string, unknown>> };
};

type EntityListItem = {
  id: string;
  type: string;
  title: string;
  summary: string;
};

export function getEffectiveEntity({ database, entityId }: { database: DatabaseLike; entityId: string }) {
  return readEffectiveEntity({ database, entityId });
}

export function listEntitiesByType({ database, type }: { database: DatabaseLike; type: string | null }): EntityListItem[] {
  const sql = type === null
    ? 'SELECT id, type, title, summary FROM base_entities ORDER BY title'
    : 'SELECT id, type, title, summary FROM base_entities WHERE type = ? ORDER BY title';

  const rows = type === null
    ? database.prepare(sql).all()
    : database.prepare(sql).all(type);

  return rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    title: String(row.title),
    summary: String(row.summary),
  }));
}
