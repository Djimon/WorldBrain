// M10-S08 + D30 (#376): Player-Charakter — CRUD auf eigener Tabelle
// `player_characters` (nicht mehr in `base_entities`). Der Bogen liegt in
// sheet_json (frei strukturiert; system_plugin_id-Schema folgt aus M9).
// D10: genau 1 Charakter pro (campaignId, playerId).
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
  /** Frei strukturierter Bogen (S08/M9-S03). Beispiel: { name, summary,
   *  class, hp, ... }. Wird als JSON persistiert. */
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
