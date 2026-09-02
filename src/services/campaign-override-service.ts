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
  const overrides = await db.select<{ patch_json: string; campaign_created: number }>(
    `SELECT patch_json, campaign_created FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
  );
  if (!overrides[0]) throw new Error('No override to promote');
  const now = new Date().toISOString();

  const base = await db.select<{ properties_json: string }>(
    `SELECT properties_json FROM base_entities WHERE id = ?`,
    [params.entityId],
  );

  if (base[0]) {
    // Existing world entity: merge the patch onto the base (reversible via pre_promote_json).
    const prevBaseJson = base[0].properties_json;
    const merged = {
      ...(JSON.parse(prevBaseJson) as Record<string, unknown>),
      ...(JSON.parse(overrides[0].patch_json) as Record<string, unknown>),
    };
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
    return;
  }

  // No base row: only a campaign-created entity (#415) can be promoted here. Promote ABSORBS
  // it fully into the world — INSERT the entity into base and DELETE the campaign_created
  // override row. Afterwards it is an ordinary world entity: later campaign edits become
  // ordinary (reversible) overrides with their own promote/unpromote, and nothing is stuffed
  // back into the old campaign_created block. Removal is via the normal delete button.
  if (overrides[0].campaign_created !== 1) throw new Error('No base entity to promote onto');
  const e = JSON.parse(overrides[0].patch_json) as Record<string, unknown>;
  await db.execute(
    `INSERT INTO base_entities (id, type, title, summary, properties_json, aliases_json, body_json, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.entityId,
      String(e.type ?? ''),
      String(e.title ?? ''),
      String(e.summary ?? ''),
      JSON.stringify(e.properties ?? {}),
      JSON.stringify(e.aliases ?? []),
      JSON.stringify(e.body ?? { format: 'portable_blocks_v1', blocks: [] }),
      String(e.visibility ?? 'public'),
      now,
      now,
    ],
  );
  await db.execute(
    `DELETE FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ?`,
    [params.campaignId, params.entityId],
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

// ── #415: campaign-created entities ──────────────────────────────────────────
// A campaign-created entity exists ONLY as an override row (campaign_created=1) with NO
// base_entities row; its patch_json holds the FULL entity. It is visible only inside its
// campaign until an explicit promote lifts it into the world base.

export interface CampaignEntityInput {
  type: string;
  title: string;
  summary?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  body?: { format: 'portable_blocks_v1'; blocks: unknown[] };
  visibility?: string;
}

export interface CampaignCreatedRow {
  id: string;
  type: string;
  title: string;
  summary: string;
  properties_json: string;
}

function fullEntityJson(input: CampaignEntityInput): string {
  return JSON.stringify({
    type: input.type,
    title: input.title,
    summary: input.summary ?? '',
    aliases: input.aliases ?? [],
    properties: input.properties ?? {},
    body: input.body ?? { format: 'portable_blocks_v1', blocks: [] },
    visibility: input.visibility ?? 'public',
  });
}

/**
 * Creates a campaign-owned entity as a campaign_created override row (no base_entities
 * write). Returns the new entity id. Pass `id` to control it (events use an `event-` id).
 */
export async function createCampaignEntity(
  db: DatabaseLike,
  params: { campaignId: string; entity: CampaignEntityInput; id?: string },
): Promise<string> {
  const entityId = params.id ?? `ent-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO campaign_entity_overrides (id, campaign_id, entity_id, patch_json, campaign_created, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?)`,
    [crypto.randomUUID(), params.campaignId, entityId, fullEntityJson(params.entity), now, now],
  );
  return entityId;
}

/** True when the (campaign, entity) override row is a campaign-created entity (no base row). */
export async function isCampaignCreated(
  db: DatabaseLike,
  params: { campaignId: string; entityId: string },
): Promise<boolean> {
  const rows = await db.select<{ campaign_created: number }>(
    `SELECT campaign_created FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ? LIMIT 1`,
    [params.campaignId, params.entityId],
  );
  return rows[0]?.campaign_created === 1;
}

/**
 * Edits a campaign-created entity by writing the changed fields back into its full patch_json.
 * `properties` is replaced wholesale (the caller passes the complete intended properties).
 */
export async function updateCampaignCreatedEntity(
  db: DatabaseLike,
  params: {
    campaignId: string;
    entityId: string;
    patch: { title?: string; summary?: string; visibility?: string; aliases?: string[]; properties?: Record<string, unknown> };
  },
): Promise<void> {
  const rows = await db.select<{ patch_json: string }>(
    `SELECT patch_json FROM campaign_entity_overrides WHERE campaign_id = ? AND entity_id = ? AND campaign_created = 1`,
    [params.campaignId, params.entityId],
  );
  if (!rows[0]) return;
  const current = JSON.parse(rows[0].patch_json) as Record<string, unknown>;
  const next = { ...current };
  if (params.patch.title !== undefined) next.title = params.patch.title;
  if (params.patch.summary !== undefined) next.summary = params.patch.summary;
  if (params.patch.visibility !== undefined) next.visibility = params.patch.visibility;
  if (params.patch.aliases !== undefined) next.aliases = params.patch.aliases;
  if (params.patch.properties !== undefined) next.properties = params.patch.properties;
  await db.execute(
    `UPDATE campaign_entity_overrides SET patch_json = ?, updated_at = ? WHERE campaign_id = ? AND entity_id = ? AND campaign_created = 1`,
    [JSON.stringify(next), new Date().toISOString(), params.campaignId, params.entityId],
  );
}

/**
 * Lists a campaign's own (not-yet-promoted) campaign-created entities, shaped like base rows
 * so entity/event listings can merge them in. Promoted ones are already in base → excluded.
 */
export async function listCampaignCreatedEntities(
  db: DatabaseLike,
  campaignId: string,
): Promise<CampaignCreatedRow[]> {
  const rows = await db.select<{ entity_id: string; patch_json: string }>(
    `SELECT entity_id, patch_json FROM campaign_entity_overrides
      WHERE campaign_id = ? AND campaign_created = 1 AND promoted_at IS NULL`,
    [campaignId],
  );
  return rows.map((r) => {
    const e = JSON.parse(r.patch_json) as Record<string, unknown>;
    return {
      id: r.entity_id,
      type: String(e.type ?? ''),
      title: String(e.title ?? ''),
      summary: String(e.summary ?? ''),
      properties_json: JSON.stringify(e.properties ?? {}),
    };
  });
}
