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

function generateId(): string {
  return 'rel_' + crypto.randomUUID();
}

async function logEvent(db: DatabaseLike, relationId: string, event: string): Promise<void> {
  await db.execute(
    "INSERT INTO campaign_relation_log (id, relation_id, event, timestamp) VALUES (?, ?, ?, datetime('now'))",
    [generateId(), relationId, event],
  );
}

export async function addRelation(db: DatabaseLike, params: AddRelationParams): Promise<{ id: string }> {
  const id = generateId();
  const inverseType = params.inverse_type ?? params.relation_type;
  await db.execute(
    `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes)
     VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, params.source_id, params.target_id, params.relation_type, inverseType,
     JSON.stringify(params.visibility), params.notes ?? null],
  );
  await logEvent(db, id, 'added');
  return { id };
}

export async function getRelations(db: DatabaseLike, entityId: string, options: { includeInactive: boolean }): Promise<RelationRow[]> {
  const activeClause = options.includeInactive ? '' : 'AND active = 1';
  return db.select<RelationRow>(
    `SELECT * FROM relations WHERE (source_id = ? OR target_id = ?) ${activeClause}`,
    [entityId, entityId],
  );
}

export async function deactivateRelation(db: DatabaseLike, relationId: string): Promise<void> {
  await db.execute('UPDATE relations SET active = 0 WHERE id = ?', [relationId]);
  await logEvent(db, relationId, 'removed');
}

export async function reactivateRelation(db: DatabaseLike, relationId: string): Promise<void> {
  await db.execute('UPDATE relations SET active = 1 WHERE id = ?', [relationId]);
  await logEvent(db, relationId, 'added');
}

export async function getAllRelations(db: DatabaseLike, { includeInactive }: { includeInactive?: boolean } = {}): Promise<RelationRow[]> {
  const sql = includeInactive
    ? 'SELECT id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes FROM relations'
    : 'SELECT id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes FROM relations WHERE active = 1';
  return db.select<RelationRow>(sql);
}
