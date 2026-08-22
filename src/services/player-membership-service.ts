// M10-S03 (#352): Spieler-Mitgliedschaft — Schema & Services (campaign-scoped).
// D24 Auto-Join: kein `pending`/`approve`/`reject`. Jeder Beitritt landet
// direkt als `active`. Kick invalidiert das Token.
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
 * Low-level insert: legt einen `session_players`-Eintrag mit `status='active'`
 * an. Der komplette Auto-Join-Flow (Code → Player + Token) lebt in
 * `session-identity-service.joinWithCode`, das diese Funktion darunter nutzt.
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
 * Kick: setzt `status='kicked'` und leert den `token_hash` — der bisherige
 * Token wird damit für validateToken() unbrauchbar (D24).
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
