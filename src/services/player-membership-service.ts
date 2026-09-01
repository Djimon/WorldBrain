// M10-S03 (#352): Player membership — schema & services (campaign-scoped).
// D24 auto-join: no `pending`/`approve`/`reject`. Every join lands
// directly as `active`. Kick invalidates the token.
import type { DatabaseLike } from './entity-service';

export interface Player {
  id: string;
  display_name: string;
  created_at: string;
}

export interface SessionPlayer {
  id: string;
  campaign_id: string;
  player_id: string;
  token_hash: string | null;
  status: 'active' | 'kicked';
  joined_at: string;
}

export interface CreatePlayerParams {
  displayName: string;
}

export interface JoinWithCodeParams {
  campaignId: string;
  playerId: string;
  tokenHash: string;
}

export interface KickParams {
  campaignId: string;
  playerId: string;
}

export async function createPlayer(db: DatabaseLike, params: CreatePlayerParams): Promise<Player> {
  const id = `player_${crypto.randomUUID()}`;
  const created_at = new Date().toISOString();
  await db.execute(
    'INSERT INTO players (id, display_name, created_at) VALUES (?, ?, ?)',
    [id, params.displayName, created_at],
  );
  return { id, display_name: params.displayName, created_at };
}

/**
 * Low-level insert: creates a `session_players` entry with `status='active'`.
 * The complete auto-join flow (code → player + token) lives in
 * `session-identity-service.joinWithCode`, which uses this function underneath.
 */
export async function joinWithCode(db: DatabaseLike, params: JoinWithCodeParams): Promise<void> {
  const id = `sp_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO session_players (id, campaign_id, player_id, token_hash, status, joined_at) VALUES (?, ?, ?, ?, 'active', ?)",
    [id, params.campaignId, params.playerId, params.tokenHash, now],
  );
}

/**
 * Kick: sets `status='kicked'` and clears the `token_hash` — the previous
 * token thereby becomes unusable for validateToken() (D24).
 */
export async function kick(db: DatabaseLike, params: KickParams): Promise<void> {
  await db.execute(
    "UPDATE session_players SET status = 'kicked', token_hash = NULL WHERE campaign_id = ? AND player_id = ?",
    [params.campaignId, params.playerId],
  );
}

export async function listCampaignPlayers(db: DatabaseLike, campaignId: string): Promise<SessionPlayer[]> {
  return db.select<SessionPlayer>(
    'SELECT id, campaign_id, player_id, token_hash, status, joined_at FROM session_players WHERE campaign_id = ?',
    [campaignId],
  );
}
