// M10-S02 (#196): Session-Identität, Einladungscodes, Token-Auth.
// Einladungscode kryptografisch zufällig (crypto.getRandomValues), nicht
// erratbar. Tokens server-seitig der Session-Mitgliedschaft zugeordnet.
// Tokens werden nie geloggt, nie an andere Spieler ausgeliefert (D18-Security).
import type { DatabaseLike } from './entity-service';

export interface SessionInvite {
  code: string;          // human-readable invite code (short, shareable)
  sessionId: string;
  created_at: string;
}

export interface PlayerToken {
  token: string;         // opaque bearer token, never logged
  playerId: string;
  sessionId: string;
  created_at: string;
}

// Generates a cryptographically random invite code (not guessable).
// Invalidates any previous code for this session (only one active at a time).
export async function generateInviteCode(
  _db: DatabaseLike,
  _sessionId: string,
): Promise<SessionInvite> {
  throw new Error('not implemented');
}

// Returns the current active invite code for a session, or null if none.
export async function getActiveInviteCode(
  _db: DatabaseLike,
  _sessionId: string,
): Promise<SessionInvite | null> {
  throw new Error('not implemented');
}

// Join with a valid code → creates a PlayerToken associated with this session.
// Rejects (throws) if code is invalid or already expired/replaced.
// D10: one entry per client.
export async function joinWithCode(
  _db: DatabaseLike,
  _params: { sessionId: string; code: string; displayName: string },
): Promise<PlayerToken> {
  throw new Error('not implemented');
}

// Auth middleware: resolves to the PlayerToken if the token is valid + approved
// for the given session. Throws if token is unknown, revoked, or wrong session.
export async function validateToken(
  _db: DatabaseLike,
  _params: { sessionId: string; token: string },
): Promise<PlayerToken> {
  throw new Error('not implemented');
}

// HTML-escape all user-supplied strings before interpolation into exported HTML.
// CSP-Meta must be present in any exported HTML output (AC: "All user-supplied
// strings HTML-escaped vor Interpolation in exportiertes HTML").
export function escapeHtml(_raw: string): string {
  throw new Error('not implemented');
}
