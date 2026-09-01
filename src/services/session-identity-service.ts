// M10-S02 (#351): Campaign identity, invite codes & token auth (auto-join).
// D24: valid code → immediately an active member, NO approve step.
// Decision 8: the token is checked on every message (validateToken), not only
// at the handshake.
import type { DatabaseLike } from './entity-service';

export interface GenerateInviteParams {
  campaignId: string;
}

export interface JoinWithCodeParams {
  code: string;
  displayName: string;
}

export interface JoinResult {
  token: string;
  playerId: string;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
const TOKEN_BYTES = 32;

/** Cryptographically random, shareable invite code (confusion-free alphabet). */
function randomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function randomToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashToken(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Current invite code of a campaign (the most recently generated, not
 * invalidated one). Null if none has ever been created. The UI calls this
 * on mount, instead of silently creating a new one (#371 Fix 1).
 */
export async function getActiveInviteCode(db: DatabaseLike, campaignId: string): Promise<string | null> {
  const rows = await db.select<{ code: string }>(
    "SELECT code FROM invite_codes WHERE campaign_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1",
    [campaignId],
  );
  return rows[0]?.code ?? null;
}

/**
 * Creates a new invite code for the campaign and marks all
 * existing active codes of the same campaign as invalidated.
 * Already logged-in players keep their token (D24 — the invalidation
 * applies only to NEW joins).
 */
export async function generateInviteCode(db: DatabaseLike, params: GenerateInviteParams): Promise<string> {
  await db.execute(
    "UPDATE invite_codes SET status = 'invalidated' WHERE campaign_id = ? AND status = 'active'",
    [params.campaignId],
  );
  const id = `invite_${crypto.randomUUID()}`;
  const code = randomCode();
  const now = new Date().toISOString();
  await db.execute(
    "INSERT INTO invite_codes (id, campaign_id, code, status, created_at) VALUES (?, ?, ?, 'active', ?)",
    [id, params.campaignId, code, now],
  );
  return code;
}

/**
 * Valid code → immediately creates player + session_players (`status='active'`)
 * and returns the token. Invalid/invalidated code → error.
 */
export async function joinWithCode(db: DatabaseLike, params: JoinWithCodeParams): Promise<JoinResult> {
  const rows = await db.select<{ campaign_id: string }>(
    "SELECT campaign_id FROM invite_codes WHERE code = ? AND status = 'active'",
    [params.code],
  );
  const invite = rows[0];
  if (!invite) throw new Error('Invalid or invalidated invite code');

  const playerId = `player_${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  await db.execute(
    'INSERT INTO players (id, display_name, created_at) VALUES (?, ?, ?)',
    [playerId, params.displayName, now],
  );

  const token = randomToken();
  const tokenHash = await hashToken(token);
  const membershipId = `sp_${crypto.randomUUID()}`;
  await db.execute(
    "INSERT INTO session_players (id, campaign_id, player_id, token_hash, status, joined_at) VALUES (?, ?, ?, ?, 'active', ?)",
    [membershipId, invite.campaign_id, playerId, tokenHash, now],
  );

  return { token, playerId };
}

/**
 * Checks whether the token belongs to an active (not kicked) member.
 * Called per message (Decision 8: server-side enforcement).
 */
export async function validateToken(db: DatabaseLike, token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  const rows = await db.select<{ id: string }>(
    "SELECT id FROM session_players WHERE token_hash = ? AND status = 'active'",
    [tokenHash],
  );
  return rows.length > 0;
}

/**
 * Resolves an invite code to its campaign without triggering a join.
 * Returns `null` for an unknown/invalidated code. The host join
 * handler (#387) uses this as a pre-validation, so that invalid codes produce a
 * `join_response{ok:false}` WITHOUT having to catch `joinWithCode`'s throw
 * (AP-006: no try/catch around DB operations).
 */
export async function resolveCampaignForCode(db: DatabaseLike, code: string): Promise<string | null> {
  const rows = await db.select<{ campaign_id: string }>(
    "SELECT campaign_id FROM invite_codes WHERE code = ? AND status = 'active'",
    [code],
  );
  return rows[0]?.campaign_id ?? null;
}

/**
 * Resolves an active token to its member (player_id) — for the transport-
 * based reconnect (#387): the player sends only its token, the host finds
 * the active `session_players` member and sends a new `join_response`.
 * `null` if the token is unknown or the member is kicked/inactive.
 */
export async function resolvePlayerByToken(db: DatabaseLike, token: string): Promise<{ playerId: string } | null> {
  const tokenHash = await hashToken(token);
  const rows = await db.select<{ player_id: string }>(
    "SELECT player_id FROM session_players WHERE token_hash = ? AND status = 'active'",
    [tokenHash],
  );
  const row = rows[0];
  return row ? { playerId: row.player_id } : null;
}
