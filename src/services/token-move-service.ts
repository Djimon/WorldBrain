// M10 (#299): Token-Bewegungsrechte — server-seitige Autorisierung (D18/Decision 8).
// V1-Default: jeder approved Spieler bewegt jeden Token (controller='players').
// Optionaler DM-Lock (controller='dm' / owner_player_id) ist Kür, needs-decision.
// DM darf immer; nicht-autorisierter Move → throw (kein Persist, kein Broadcast).
import type { DatabaseLike } from './entity-service';

export interface TokenMoveParams {
  sessionId: string;
  requestingPlayerId: string;
  tokenId: string;
  toX: number;
  toY: number;
  isDm?: boolean;
}

interface TokenRow {
  controller: string;
  owner_player_id: string | null;
}

async function isApprovedPlayer(
  db: DatabaseLike,
  sessionId: string,
  playerId: string,
): Promise<boolean> {
  const rows = await db.select<{ player_id: string }>(
    `SELECT player_id FROM session_players WHERE session_id = ? AND player_id = ? AND invite_status = 'approved'`,
    [sessionId, playerId],
  );
  return rows.length > 0;
}

export async function canMoveToken(
  db: DatabaseLike,
  params: { sessionId: string; requestingPlayerId: string; tokenId: string; isDm?: boolean },
): Promise<boolean> {
  if (params.isDm) return true;

  const tokens = await db.select<TokenRow>(
    `SELECT controller, owner_player_id FROM map_tokens WHERE id = ?`,
    [params.tokenId],
  );
  if (!tokens[0]) return false;

  const { controller, owner_player_id } = tokens[0];

  if (owner_player_id) {
    return params.requestingPlayerId === owner_player_id;
  }

  if (controller === 'dm') return false;

  return isApprovedPlayer(db, params.sessionId, params.requestingPlayerId);
}

export async function moveToken(
  db: DatabaseLike,
  params: TokenMoveParams,
): Promise<void> {
  const allowed = await canMoveToken(db, params);
  if (!allowed) throw new Error('Not authorized to move this token');

  await db.execute(
    `UPDATE map_tokens SET x = ?, y = ? WHERE id = ?`,
    [params.toX, params.toY, params.tokenId],
  );
}
