// M10-S03: Spieler-Mitgliedschaft — Schema & Services (EPIC-016)
// Player identity is global (players table); membership is per session
// (session_players table) with an invite lifecycle: pending → approved →
// (kicked) or rejected. A player's token belongs to exactly one session row.
import type { DatabaseLike } from './entity-service';

export interface Player {
  id: string;
  display_name: string;
  created_at: string;
}

export interface SessionPlayer {
  session_id: string;
  player_id: string;
  token_hash: string;
  invite_status: string;
  joined_at: string | null;
}

export async function createPlayer(params: { database: DatabaseLike; displayName: string }): Promise<Player> {
  const id = `player_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  await params.database.execute(
    'INSERT INTO players (id, display_name, created_at) VALUES (?, ?, ?)',
    [id, params.displayName, created_at],
  );
  return { id, display_name: params.displayName, created_at };
}

export async function requestJoin(params: {
  database: DatabaseLike;
  sessionId: string;
  playerId: string;
  tokenHash: string;
}): Promise<void> {
  await params.database.execute(
    'INSERT INTO session_players (session_id, player_id, token_hash, invite_status, joined_at) VALUES (?, ?, ?, ?, ?)',
    [params.sessionId, params.playerId, params.tokenHash, 'pending', null],
  );
}

async function setInviteStatus(
  database: DatabaseLike,
  sessionId: string,
  playerId: string,
  status: string,
  joinedAt: string | null,
): Promise<void> {
  await database.execute(
    'UPDATE session_players SET invite_status = ?, joined_at = COALESCE(?, joined_at) WHERE session_id = ? AND player_id = ?',
    [status, joinedAt, sessionId, playerId],
  );
}

export async function approve(params: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> {
  await setInviteStatus(params.database, params.sessionId, params.playerId, 'approved', new Date().toISOString());
}

export async function reject(params: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> {
  await setInviteStatus(params.database, params.sessionId, params.playerId, 'rejected', null);
}

export async function kick(params: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> {
  await setInviteStatus(params.database, params.sessionId, params.playerId, 'kicked', null);
}

export async function listSessionPlayers(params: { database: DatabaseLike; sessionId: string }): Promise<SessionPlayer[]> {
  return params.database.select<SessionPlayer>(
    "SELECT session_id, player_id, token_hash, invite_status, joined_at FROM session_players WHERE session_id = ? AND invite_status = 'approved'",
    [params.sessionId],
  );
}
