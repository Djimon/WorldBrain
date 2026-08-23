// M10-S08 (#357): Spieler-Charakter — CRUD auf base_entities mit
// `is_player_character: true` + player_id + campaign_id in properties.
// D10: genau 1 Charakter pro (campaignId, playerId).
// D20: Spieler bearbeitet nur den eigenen; fremde Bögen sind nicht sichtbar.
import type { DatabaseLike } from './entity-service';

export interface PlayerCharacter {
  id: string;
  title: string;
  summary: string;
  campaign_id: string;
  player_id: string;
}

interface PlayerCharacterProps {
  is_player_character?: boolean;
  campaign_id?: string;
  player_id?: string;
}

interface PlayerCharacterRow {
  id: string;
  title: string;
  summary: string;
  properties_json: string;
}

function parseProps(json: string): PlayerCharacterProps {
  try {
    const p = JSON.parse(json);
    return typeof p === 'object' && p !== null ? p as PlayerCharacterProps : {};
  } catch {
    return {};
  }
}

/**
 * Sucht den Charakter eines Spielers in einer Campaign. Null wenn (noch) keiner
 * existiert — dann greift der Erstellungs-Flow.
 */
export async function getPlayerCharacter(
  db: DatabaseLike,
  campaignId: string,
  playerId: string,
): Promise<PlayerCharacter | null> {
  const rows = await db.select<PlayerCharacterRow>(
    "SELECT id, title, summary, properties_json FROM base_entities WHERE type = 'Character'",
  );
  for (const row of rows) {
    const p = parseProps(row.properties_json);
    if (p.is_player_character === true && p.campaign_id === campaignId && p.player_id === playerId) {
      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        campaign_id: campaignId,
        player_id: playerId,
      };
    }
  }
  return null;
}

export interface CreatePlayerCharacterParams {
  campaignId: string;
  playerId: string;
  name: string;
  summary?: string;
}

/**
 * Legt einen neuen Player-Charakter an. Wirft, wenn für (campaignId, playerId)
 * schon einer existiert — D10: genau 1 Charakter pro Spieler pro Campaign.
 */
export async function createPlayerCharacter(
  db: DatabaseLike,
  params: CreatePlayerCharacterParams,
): Promise<PlayerCharacter> {
  const existing = await getPlayerCharacter(db, params.campaignId, params.playerId);
  if (existing !== null) throw new Error('Player already has a character in this campaign');

  const id = `pc_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const props: PlayerCharacterProps = {
    is_player_character: true,
    campaign_id: params.campaignId,
    player_id: params.playerId,
  };
  await db.execute(
    `INSERT INTO base_entities (id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)
     VALUES (?, 'Character', ?, ?, '[]', ?, '{"format":"portable_blocks_v1","blocks":[]}', 'public', ?, ?)`,
    [id, params.name, params.summary ?? '', JSON.stringify(props), now, now],
  );
  return {
    id,
    title: params.name,
    summary: params.summary ?? '',
    campaign_id: params.campaignId,
    player_id: params.playerId,
  };
}

export interface UpdatePlayerCharacterParams {
  title?: string;
  summary?: string;
}

export async function updatePlayerCharacter(
  db: DatabaseLike,
  id: string,
  patch: UpdatePlayerCharacterParams,
): Promise<void> {
  const fields: string[] = [];
  const args: unknown[] = [];
  if (patch.title !== undefined) { fields.push('title = ?'); args.push(patch.title); }
  if (patch.summary !== undefined) { fields.push('summary = ?'); args.push(patch.summary); }
  if (fields.length === 0) return;
  fields.push('updated_at = ?');
  args.push(new Date().toISOString(), id);
  await db.execute(`UPDATE base_entities SET ${fields.join(', ')} WHERE id = ?`, args);
}
