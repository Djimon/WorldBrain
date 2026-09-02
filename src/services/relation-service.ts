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
  /** #418: set when this relation is campaign-local (lives in campaign_relations); the id of
   *  its owning campaign. Undefined for world relations. Drives the UI marker + which table
   *  deactivate/reactivate/promote act on. */
  campaignId?: string;
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

export async function getRelations(
  db: DatabaseLike,
  entityId: string,
  options: { includeInactive: boolean },
  campaignId?: string,
): Promise<RelationRow[]> {
  const activeClause = options.includeInactive ? '' : 'AND active = 1';
  const world = await db.select<RelationRow>(
    `SELECT * FROM relations WHERE (source_id = ? OR target_id = ?) ${activeClause}`,
    [entityId, entityId],
  );
  // #418: without a campaign, world relations only (edit mode / author). In a campaign, also
  // merge that campaign's own campaign-local relations, tagged so the UI/actions know.
  if (!campaignId) return world;
  const camp = await db.select<RelationRow>(
    `SELECT id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes
       FROM campaign_relations
      WHERE campaign_id = ? AND (source_id = ? OR target_id = ?) ${activeClause}`,
    [campaignId, entityId, entityId],
  ).catch(() => [] as RelationRow[]);
  return [...world, ...camp.map((r) => ({ ...r, campaignId }))];
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

// ── #418: campaign-local relations ───────────────────────────────────────────
// Same shape as world relations but scoped to a campaign (own table). A DM in a campaign
// creates these instead of world relations; endpoints may be campaign-created entities
// (#415). They reach the world only via promoteCampaignRelation (clean absorb).

export async function addCampaignRelation(
  db: DatabaseLike,
  params: AddRelationParams & { campaignId: string },
): Promise<{ id: string }> {
  const id = generateId();
  const inverseType = params.inverse_type ?? params.relation_type;
  await db.execute(
    `INSERT INTO campaign_relations (id, campaign_id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, params.campaignId, params.source_id, params.target_id, params.relation_type, inverseType,
     JSON.stringify(params.visibility), params.notes ?? null],
  );
  return { id };
}

export async function deactivateCampaignRelation(db: DatabaseLike, relationId: string): Promise<void> {
  await db.execute("UPDATE campaign_relations SET active = 0, updated_at = datetime('now') WHERE id = ?", [relationId]);
}

export async function reactivateCampaignRelation(db: DatabaseLike, relationId: string): Promise<void> {
  await db.execute("UPDATE campaign_relations SET active = 1, updated_at = datetime('now') WHERE id = ?", [relationId]);
}

/**
 * Promotes a campaign-local relation into the world: INSERT into `relations` and DELETE the
 * campaign_relations row (clean absorb, mirroring #415's entity promote). No unpromote —
 * removal afterwards is the normal deactivate/delete.
 */
export async function promoteCampaignRelation(
  db: DatabaseLike,
  params: { campaignId: string; relationId: string },
): Promise<{ id: string }> {
  const rows = await db.select<RelationRow>(
    `SELECT id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes
       FROM campaign_relations WHERE id = ? AND campaign_id = ?`,
    [params.relationId, params.campaignId],
  );
  const rel = rows[0];
  if (!rel) throw new Error('No campaign relation to promote');
  const worldId = generateId();
  await db.execute(
    `INSERT INTO relations (id, source_id, target_id, relation_type, inverse_type, active, visibility_json, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [worldId, rel.source_id, rel.target_id, rel.relation_type, rel.inverse_type, rel.active, rel.visibility_json, rel.notes ?? null],
  );
  await logEvent(db, worldId, 'added');
  await db.execute(`DELETE FROM campaign_relations WHERE id = ? AND campaign_id = ?`, [params.relationId, params.campaignId]);
  return { id: worldId };
}
