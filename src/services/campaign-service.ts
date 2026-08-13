import type { DatabaseLike } from './entity-service';

export interface Campaign {
  id: string;
  title: string;
  created_at: string;
}

export interface CampaignOverride {
  id: string;
  campaign_id: string;
  entity_id: string;
  patch_json: string;
  created_at: string;
  updated_at: string;
}

export async function createCampaign(
  db: DatabaseLike,
  params: { title: string },
): Promise<Campaign> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO campaigns (id, title, created_at) VALUES (?, ?, ?)`,
    [id, params.title, now],
  );
  return { id, title: params.title, created_at: now };
}

export async function listCampaigns(db: DatabaseLike): Promise<Campaign[]> {
  return db.select<Campaign>(`SELECT id, title, created_at FROM campaigns ORDER BY created_at ASC`);
}

export async function getCampaign(db: DatabaseLike, id: string): Promise<Campaign | null> {
  const rows = await db.select<Campaign>(
    `SELECT id, title, created_at FROM campaigns WHERE id = ?`,
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteCampaign(db: DatabaseLike, id: string): Promise<void> {
  await db.execute(`DELETE FROM campaigns WHERE id = ?`, [id]);
}

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

export async function getCampaignOverrides(
  db: DatabaseLike,
  campaignId: string,
): Promise<CampaignOverride[]> {
  return db.select<CampaignOverride>(
    `SELECT id, campaign_id, entity_id, patch_json, created_at, updated_at
     FROM campaign_entity_overrides WHERE campaign_id = ?`,
    [campaignId],
  );
}
