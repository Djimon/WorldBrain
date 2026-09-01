// M10-S08 + D30 (#376): player character — CRUD on its own table
// `player_characters` (no longer in `base_entities`). The sheet lives in
// sheet_json (freely structured; system_plugin_id schema follows from M9).
// D10: exactly 1 character per (campaignId, playerId).
import type { DatabaseLike } from './entity-service';

export interface PlayerCharacter {
  id: string;
  campaign_id: string;
  player_id: string;
  sheet: Record<string, unknown>;
}

interface PlayerCharacterRow {
  id: string;
  campaign_id: string;
  player_id: string;
  sheet_json: string;
}

function parseSheet(json: string): Record<string, unknown> {
  try {
    const s = JSON.parse(json);
    return typeof s === 'object' && s !== null && !Array.isArray(s) ? (s as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function getPlayerCharacter(
  db: DatabaseLike,
  campaignId: string,
  playerId: string,
): Promise<PlayerCharacter | null> {
  const rows = await db.select<PlayerCharacterRow>(
    'SELECT id, campaign_id, player_id, sheet_json FROM player_characters WHERE campaign_id = ? AND player_id = ? LIMIT 1',
    [campaignId, playerId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    campaign_id: row.campaign_id,
    player_id: row.player_id,
    sheet: parseSheet(row.sheet_json),
  };
}

export interface CreatePlayerCharacterParams {
  campaignId: string;
  playerId: string;
  /** Freely structured sheet (S08/M9-S03). Example: { name, summary,
   *  class, hp, ... }. Persisted as JSON. */
  sheetJson: Record<string, unknown>;
}

export async function createPlayerCharacter(
  db: DatabaseLike,
  params: CreatePlayerCharacterParams,
): Promise<PlayerCharacter> {
  const existing = await getPlayerCharacter(db, params.campaignId, params.playerId);
  if (existing !== null) throw new Error('Player already has a character in this campaign');

  const id = `pc_${crypto.randomUUID()}`;
  await db.execute(
    'INSERT INTO player_characters (id, campaign_id, player_id, sheet_json) VALUES (?, ?, ?, ?)',
    [id, params.campaignId, params.playerId, JSON.stringify(params.sheetJson)],
  );
  return {
    id,
    campaign_id: params.campaignId,
    player_id: params.playerId,
    sheet: params.sheetJson,
  };
}

export interface UpdatePlayerCharacterParams {
  /** Neuer kompletter Bogen — replace-Semantik. */
  sheetJson: Record<string, unknown>;
}

export async function updatePlayerCharacter(
  db: DatabaseLike,
  id: string,
  patch: UpdatePlayerCharacterParams,
): Promise<void> {
  await db.execute(
    'UPDATE player_characters SET sheet_json = ? WHERE id = ?',
    [JSON.stringify(patch.sheetJson), id],
  );
}
