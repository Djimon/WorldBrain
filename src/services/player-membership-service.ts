// M10-S03: Spieler-Mitgliedschaft — Schema & Services (EPIC-016)
// D24 (#340): Auto-Join-Modell — kein pending/approve/reject; status: active|kicked.
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
  status: string;
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

export async function kick(params: { database: DatabaseLike; sessionId: string; playerId: string }): Promise<void> {
  await params.database.execute(
    "UPDATE session_players SET status = 'kicked' WHERE session_id = ? AND player_id = ?",
    [params.sessionId, params.playerId],
  );
}

export async function listSessionPlayers(params: { database: DatabaseLike; sessionId: string }): Promise<SessionPlayer[]> {
  return params.database.select<SessionPlayer>(
    "SELECT session_id, player_id, token_hash, status, joined_at FROM session_players WHERE session_id = ? AND status = 'active'",
    [params.sessionId],
  );
}
