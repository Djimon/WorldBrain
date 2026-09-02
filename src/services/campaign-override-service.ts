// M10-S21 (#365, D23): campaign-override default + reversible promote.
//
// When the DM edits within a campaign, the change lands as an override
// (`campaign_entity_overrides.patch_json`) — the base world (`base_entities`)
// stays untouched. The effective view = world + override.
//
// Promote lifts the WHOLE entity override into the world base (opt-in, one click).
// REVERSIBLE: the override is NOT deleted (remains traceable), and
// the previous world state is snapshotted into `pre_promote_json`, so that
// `unpromoteOverride` restores it.
import type { DatabaseLike } from './entity-service';

export interface EffectiveEntity {
  entityId: string;
  properties: Record<string, unknown>;
}

/**
 * Editing within a campaign = write override (upsert), base world stays
 * untouched. Campaign-scoped via the UNIQUE index (campaign_id, entity_id).
 */
export async function upsertCampaignOverride(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string; patchJson: string },
): Promise<void> {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO campaign_entity_overrides (id, campaign_id, entity_id, patch_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (campaign_id, entity_id) DO UPDATE SET patch_json = excluded.patch_json, updated_at = excluded.updated_at`,
    [id, params.campaignId, params.entityId, params.patchJson, now, now],
  );
}

/**
 * Effective view for a campaign = base properties overlaid with the
 * override patch. No override → pure base.
 */
export async function getEffectiveForCampaign(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<EffectiveEntity | null> {
  const base = await db.select<{ properties_json: string }>(
    `SELECT properties_json FROM base_entities WHERE id = ?`,
    [params.entityId],
  );
  if (!base[0]) return null;
  const baseProps = JSON.parse(base[0].properties_json) as Record<string, unknown>;

  const overrides = await db.select<{ patch_json: string }>(
    `SELECT patch_json FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
  const properties = overrides[0]
    ? { ...baseProps, ...(JSON.parse(overrides[0].patch_json) as Record<string, unknown>) }
    : baseProps;
  return { entityId: params.entityId, properties };
}

/**
 * Promote: write the WHOLE override into the world base (visible to all
 * campaigns afterwards). REVERSIBLE — the previous base state is
 * snapshotted into pre_promote_json and the override is preserved.
 */
export async function promoteOverride(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<void> {
  const overrides = await db.select<{ patch_json: string }>(
    `SELECT patch_json FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
  if (!overrides[0]) throw new Error('No override to promote');

  const base = await db.select<{ properties_json: string }>(
    `SELECT properties_json FROM base_entities WHERE id = ?`,
    [params.entityId],
  );
  const prevBaseJson = base[0]?.properties_json ?? '{}';
  const merged = {
    ...(JSON.parse(prevBaseJson) as Record<string, unknown>),
    ...(JSON.parse(overrides[0].patch_json) as Record<string, unknown>),
  };
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE base_entities SET properties_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(merged), now, params.entityId],
  );
  // Do NOT delete the override — only mark the promote state (reversible).
  await db.execute(
    `UPDATE campaign_entity_overrides
       SET promoted_at = ?, pre_promote_json = ?, updated_at = ?
     WHERE campaign_id = ? AND entity_id = ?`,
    [now, prevBaseJson, now, params.campaignId, params.entityId],
  );
}

/**
 * Reverses a promote: sets the world base back to the snapshotted
 * before-state and clears the promote marker. The override itself remains
 * (the campaign continues to see its change).
 */
export async function unpromoteOverride(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<void> {
  const rows = await db.select<{ pre_promote_json: string | null }>(
    `SELECT pre_promote_json FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
  const snapshot = rows[0]?.pre_promote_json;
  if (snapshot === null || snapshot === undefined) return; // was never promoted

  const now = new Date().toISOString();
  await db.execute(
    `UPDATE base_entities SET properties_json = ?, updated_at = ? WHERE id = ?`,
    [snapshot, now, params.entityId],
  );
  await db.execute(
    `UPDATE campaign_entity_overrides
       SET promoted_at = NULL, pre_promote_json = NULL, updated_at = ?
     WHERE campaign_id = ? AND entity_id = ?`,
    [now, params.campaignId, params.entityId],
  );
}

/**
 * Does a campaign override row exist for this entity? (For the UI: only then is there
 * something to promote — the promote button must not show / must not error otherwise.)
 */
export async function hasOverride(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<boolean> {
  const rows = await db.select<{ one: number }>(
    `SELECT 1 AS one FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ? LIMIT 1`,
    [params.campaignId, params.entityId],
  );
  return rows.length > 0;
}

/**
 * Is a campaign entity's override currently promoted into the world?
 * (For the UI toggle state.)
 */
export async function isPromoted(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<boolean> {
  const rows = await db.select<{ promoted_at: string | null }>(
    `SELECT promoted_at FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
  return rows[0]?.promoted_at !== null && rows[0]?.promoted_at !== undefined;
}
