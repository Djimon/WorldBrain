import type { DatabaseLike } from './entity-service';

export interface RelationRow {
  id: string;
  source_id: string;
  target_id: string;
  relation_type: string;
  inverse_type: string;
  active: number;
  visibility_json: string;
  notes: string | null;
}

interface AddRelationParams {
  source_id: string;
  target_id: string;
  relation_type: string;
  visibility: string;
  notes?: string;
  inverse_type?: string;
}

type WriteDb = {
  prepare: (sql: string) => {
    run: (...args: unknown[]) => void;
    get: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
  };
};

function randomId(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function logEvent(db: WriteDb, relationId: string, event: string): void {
  db.prepare(
    'INSERT INTO campaign_relation_log (id, relation_id, event, timestamp) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(randomId(), relationId, event);
}

export function addRelation(
  db: WriteDb,
  params: AddRelationParams
): { id: string } {
  const id = randomId();
  const inverseType = params.inverse_type ?? params.relation_type;

  db.prepare(
    `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
  ).run(
    id,
    params.source_id,
    params.target_id,
    params.relation_type,
    inverseType,
    JSON.stringify(params.visibility),
    params.notes ?? null
  );

  logEvent(db, id, 'added');
  return { id };
}

export function getRelations(
  db: DatabaseLike,
  entityId: string,
  options: { includeInactive: boolean }
): RelationRow[] {
  const activeClause = options.includeInactive ? '' : 'AND active = 1';
  return (db as WriteDb).prepare(
    `SELECT * FROM relations WHERE (source_id = ? OR target_id = ?) ${activeClause}`
  ).all(entityId, entityId) as RelationRow[];
}

export function deactivateRelation(db: WriteDb, relationId: string): void {
  db.prepare('UPDATE relations SET active = 0 WHERE id = ?').run(relationId);
  logEvent(db, relationId, 'removed');
}

export function reactivateRelation(db: WriteDb, relationId: string): void {
  db.prepare('UPDATE relations SET active = 1 WHERE id = ?').run(relationId);
  logEvent(db, relationId, 'added');
}
