// M10-S02 (#351): Campaign-Identität, Einladungscodes & Token-Auth (Auto-Join).
// D24: Gültiger Code → sofort aktives Mitglied, KEIN Approve-Schritt.
// Decision 8: Token wird bei jeder Nachricht geprüft (validateToken), nicht nur
// beim Handshake.
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

/** Kryptografisch zufälliger, teilbarer Einladungscode (verwechslungsfreies Alphabet). */
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
 * Erzeugt einen neuen Einladungscode für die Campaign und markiert alle
 * bestehenden aktiven Codes derselben Campaign als invalidiert.
 * Bereits eingeloggte Spieler behalten ihr Token (D24 — die Invalidierung
 * greift nur für NEUE Joins).
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
 * Gültiger Code → legt Player + session_players (`status='active'`) sofort an
 * und gibt das Token zurück. Ungültiger/invalidierter Code → Fehler.
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
 * Prüft, ob das Token zu einem aktiven (nicht gekickten) Mitglied gehört.
 * Wird pro Nachricht aufgerufen (Decision 8: server-seitige Durchsetzung).
 */
export async function validateToken(db: DatabaseLike, token: string): Promise<boolean> {
  const tokenHash = await hashToken(token);
  const rows = await db.select<{ id: string }>(
    "SELECT id FROM session_players WHERE token_hash = ? AND status = 'active'",
    [tokenHash],
  );
  return rows.length > 0;
}
