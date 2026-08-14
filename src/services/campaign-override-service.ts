import type { DatabaseLike } from './entity-service';

export interface EffectiveEntity {
  entityId: string;
  properties: Record<string, unknown>;
}

export async function applyCampaignOverride(
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

export async function promoteOverrideToWorld(
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
  const merged = {
    ...(JSON.parse(base[0]?.properties_json ?? '{}') as Record<string, unknown>),
    ...(JSON.parse(overrides[0].patch_json) as Record<string, unknown>),
  };

  await db.execute(
    `UPDATE base_entities SET properties_json = ?, updated_at = ? WHERE id = ?`,
    [JSON.stringify(merged), new Date().toISOString(), params.entityId],
  );
  await db.execute(
    `DELETE FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
}
