// M10-S08 (#202): Spieler-Charaktererstellung im Join-Flow (D10/D13/D14).
// Ein Charakter pro Spieler pro Session (D10). Charakter = Entity mit
// is_player_character:true + player_id. Aktionsquelle für Würfe/Kampflog.
// Fremd-Bögen nicht sichtbar (D20 — Enforcement im Content-Filter-Service).
import type { DatabaseLike } from './entity-service';

export interface PlayerCharacterParams {
  sessionId: string;
  playerId: string;
  name: string;
  note?: string;
  systemPluginId?: string | null;
}

export interface PlayerCharacter {
  entityId: string;
  playerId: string;
  sessionId: string;
  name: string;
}

// Creates the player character entity. Throws if the player already has a
// character in this session (D10: exactly 1 per player per session).
export async function createPlayerCharacter(
  _db: DatabaseLike,
  _params: PlayerCharacterParams,
): Promise<PlayerCharacter> {
  throw new Error('not implemented');
}

// Returns the player's character for the given session, or null if none.
export async function getPlayerCharacter(
  _db: DatabaseLike,
  _params: { sessionId: string; playerId: string },
): Promise<PlayerCharacter | null> {
  throw new Error('not implemented');
}

// Updates the player's own character (name / properties). Throws if the
// requesting player is not the owner (D20: only own char editable).
export async function updatePlayerCharacter(
  _db: DatabaseLike,
  _params: { entityId: string; requestingPlayerId: string; name?: string; note?: string },
): Promise<void> {
  throw new Error('not implemented');
}
