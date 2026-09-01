// M10-S20 (#349): campaign bracket + campaign_id keying (D23).
// One world → multiple campaigns. Roster/overrides/visibility hang off the
// campaign, not the session date.
import type { DatabaseLike } from './entity-service';

export interface Campaign {
  id: string;
  title: string;
  world_time_start: string | null;
  created_at: string;
}

export interface CreateCampaignParams {
  title: string;
  world_time_start?: string;
}

export async function createCampaign(db: DatabaseLike, params: CreateCampaignParams): Promise<Campaign> {
  const id = `campaign_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  const world_time_start = params.world_time_start ?? null;
  await db.execute(
    'INSERT INTO campaigns (id, title, world_time_start, created_at) VALUES (?, ?, ?, ?)',
    [id, params.title, world_time_start, created_at],
  );
  return { id, title: params.title, world_time_start, created_at };
}

export async function listCampaigns(db: DatabaseLike): Promise<Campaign[]> {
  return db.select<Campaign>('SELECT id, title, world_time_start, created_at FROM campaigns ORDER BY created_at');
}

export async function getCampaign(db: DatabaseLike, id: string): Promise<Campaign | null> {
  const rows = await db.select<Campaign>(
    'SELECT id, title, world_time_start, created_at FROM campaigns WHERE id = ?',
    [id],
  );
  return rows[0] ?? null;
}

export async function deleteCampaign(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM campaigns WHERE id = ?', [id]);
}

export interface UpsertOverrideParams {
  campaignId: string;
  entityId: string;
  patchJson: string;
}

export async function upsertCampaignOverride(db: DatabaseLike, params: UpsertOverrideParams): Promise<void> {
  const existing = await db.select<{ id: string }>(
    'SELECT id FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?',
    [params.campaignId, params.entityId],
  );
  const now = new Date().toISOString();
  if (existing[0]) {
    await db.execute(
      'UPDATE campaign_entity_overrides SET patch_json = ?, updated_at = ? WHERE id = ?',
      [params.patchJson, now, existing[0].id],
    );
    return;
  }
  const id = `override_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO campaign_entity_overrides (id, campaign_id, entity_id, patch_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, params.campaignId, params.entityId, params.patchJson, now, now],
  );
}
