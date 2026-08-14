import type { DatabaseLike } from './entity-service';

export interface SessionInvite {
  code: string;
  sessionId: string;
  created_at: string;
}

export interface PlayerToken {
  token: string;
  playerId: string;
  sessionId: string;
  created_at: string;
}

function randomHex(byteCount: number): string {
  const buf = new Uint8Array(byteCount);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function generateInviteCode(db: DatabaseLike, sessionId: string): Promise<SessionInvite> {
  const code = randomHex(6); // 12 hex chars — 8+ chars, not guessable
  const now = new Date().toISOString();
  // invalidate all previous codes for this session
  await db.execute(`UPDATE invite_codes SET is_active = 0 WHERE session_id = ?`, [sessionId]);
  await db.execute(
    `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES (?, ?, ?, 1)`,
    [code, sessionId, now],
  );
  return { code, sessionId, created_at: now };
}

export async function getActiveInviteCode(
  db: DatabaseLike,
  sessionId: string,
): Promise<SessionInvite | null> {
  const rows = await db.select<{ code: string; session_id: string; created_at: string }>(
    `SELECT code, session_id, created_at FROM invite_codes WHERE session_id = ? AND is_active = 1 LIMIT 1`,
    [sessionId],
  );
  if (!rows[0]) return null;
  const r = rows[0];
  return { code: r.code, sessionId: r.session_id, created_at: r.created_at };
}

export async function joinWithCode(
  db: DatabaseLike,
  params: { sessionId: string; code: string; displayName: string },
): Promise<PlayerToken> {
  const rows = await db.select<{ code: string }>(
    `SELECT code FROM invite_codes WHERE code = ? AND session_id = ? AND is_active = 1`,
    [params.code, params.sessionId],
  );
  if (!rows[0]) throw new Error('Invalid or expired invite code');

  const playerId = crypto.randomUUID();
  const token = randomHex(20); // 40 hex chars — well above 20 char minimum
  const now = new Date().toISOString();

  await db.execute(
    `INSERT INTO players (id, display_name, created_at) VALUES (?, ?, ?)`,
    [playerId, params.displayName, now],
  );
  await db.execute(
    `INSERT INTO player_tokens (token, player_id, session_id, created_at) VALUES (?, ?, ?, ?)`,
    [token, playerId, params.sessionId, now],
  );
  return { token, playerId, sessionId: params.sessionId, created_at: now };
}

export async function validateToken(
  db: DatabaseLike,
  params: { sessionId: string; token: string },
): Promise<PlayerToken> {
  const rows = await db.select<{ token: string; player_id: string; session_id: string; created_at: string }>(
    `SELECT token, player_id, session_id, created_at FROM player_tokens WHERE token = ? AND session_id = ?`,
    [params.token, params.sessionId],
  );
  if (!rows[0]) throw new Error('Invalid or unauthorized token');
  const r = rows[0];
  return { token: r.token, playerId: r.player_id, sessionId: r.session_id, created_at: r.created_at };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
