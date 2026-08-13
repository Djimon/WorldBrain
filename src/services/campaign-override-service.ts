// M10-S21 (#338): Campaign-Override-Default + Promote-Schalter (D23).
// Edits in einer Campaign → campaign_entity_overrides (Basis-Welt unberührt).
// Promote = opt-in, schreibt Override in Basis-Welt (sehen alle Campaigns).
// ⚠️ Granularität (per-Feld vs ganze Entity) noch needs-decision → stub schreibt
//    ganzes Entity-Patch (patch_json = vollständiges properties/body-Objekt).
import type { DatabaseLike } from './entity-service';

// Writes an entity edit as a campaign-scoped override — does NOT touch
// base_entities. Idempotent: merges into existing override for same (campaign, entity).
export async function applyCampaignOverride(
  _db: DatabaseLike,
  _params: { campaignId: string; entityId: string; patchJson: string },
): Promise<void> {
  throw new Error('not implemented');
}

// Promotes a campaign override into the base world: merges the patch into
// base_entities (title/properties_json/body_json). After promote, all
// campaigns see the new base — the override is removed (consumed).
export async function promoteOverrideToWorld(
  _db: DatabaseLike,
  _params: { campaignId: string; entityId: string },
): Promise<void> {
  throw new Error('not implemented');
}

// Returns the merged (base + campaign override) properties_json for an entity
// in a given campaign context. Delegates to effective-entity resolution.
export async function getEffectiveForCampaign(
  _db: DatabaseLike,
  _params: { campaignId: string; entityId: string },
): Promise<{ title: string; properties: Record<string, unknown> } | null> {
  throw new Error('not implemented');
}
