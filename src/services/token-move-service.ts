// M10 (#299): Token-Bewegungsrechte — server-seitige Autorisierung (D18/Decision 8).
// V1-Default: jeder approved Spieler bewegt jeden Token (controller='players').
// Optionaler DM-Lock (controller='dm' / owner_player_id) ist Kür, needs-decision.
// Schema-Additionen: controller TEXT NOT NULL DEFAULT 'players', owner_player_id TEXT.
// DM darf immer; nicht-autorisierter Move → throw (kein Persist, kein Broadcast).
import type { DatabaseLike } from './entity-service';

export interface TokenMoveParams {
  sessionId: string;
  requestingPlayerId: string;   // player who is moving
  tokenId: string;
  toX: number;
  toY: number;
  isDm?: boolean;
}

// Validates and persists a token move. Throws if the requesting player is
// not authorized (based on token.controller / token.owner_player_id and
// the player's session membership). Server-side enforcement (Decision 8).
export async function moveToken(
  _db: DatabaseLike,
  _params: TokenMoveParams,
): Promise<void> {
  throw new Error('not implemented');
}

// Pure authorization check (no DB write). Returns true if the requesting
// player may move this token in this session.
export async function canMoveToken(
  _db: DatabaseLike,
  _params: { sessionId: string; requestingPlayerId: string; tokenId: string; isDm?: boolean },
): Promise<boolean> {
  throw new Error('not implemented');
}
