// M10-S10 (#359): Reconnect & token persistence.
// Persists the player token per client (localStorage, node fallback
// in-memory for tests) and provides reconnect + ping-based online detection.
// D10: NO heartbeat — only a one-time ping on opening + retry.
//
// Relationship to session-identity-service (S02): the server token lives there
// (validateToken); here lives the client-local reference entry.
import type { DatabaseLike } from './entity-service';
import { validateToken } from './session-identity-service';

const STORAGE_KEY = 'wbrain.reconnect-tokens';

export interface StoredToken {
  hostLabel: string;
  code: string;
  token: string;
  displayName: string;
  campaignName: string;
  /** For the player-client side: the server-side player_id, so that the
   *  reconnect can switch directly into the sheet view (S08). */
  playerId?: string;
  /** M10-#387: Broker namespace (appId from the invite link) + room (campaignId),
   *  so that the DB-less reconnect can rebuild the transport via signaling and
   *  send a `reconnect_request` — there is no local DB anymore. */
  appId?: string;
  roomId?: string;
  lastOnlineAt?: string;
}

// Test fallback: if no window.localStorage (Node) → in-memory map.
const memory = new Map<string, StoredToken>();

function readAll(): Map<string, StoredToken> {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return new Map(memory);
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null || raw === '') return new Map();
  try {
    const arr = JSON.parse(raw) as StoredToken[];
    return new Map(arr.map((t) => [t.token, t]));
  } catch {
    return new Map();
  }
}

function writeAll(map: Map<string, StoredToken>): void {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    memory.clear();
    for (const [k, v] of map) memory.set(k, v);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.values())));
}

export async function persistToken(entry: StoredToken): Promise<void> {
  const map = readAll();
  map.set(entry.token, entry);
  writeAll(map);
}

export async function getStoredToken(token: string): Promise<StoredToken | null> {
  return readAll().get(token) ?? null;
}

export async function listStoredTokens(): Promise<StoredToken[]> {
  return Array.from(readAll().values());
}

export async function clearStoredToken(token: string): Promise<void> {
  const map = readAll();
  map.delete(token);
  writeAll(map);
}

export interface ReconnectParams {
  token: string;
  /** Optional: with a DB set, it is checked server-side via validateToken();
   *  otherwise the reconnect falls back to the client-local heuristic (token not
   *  marked as 'kicked') — network-independent, D24. */
  database?: DatabaseLike;
}

export interface ReconnectResult {
  success: boolean;
  reason?: 'kicked' | 'unknown' | 'no_host';
}

/**
 * Reconnect: valid, active token → success. Kicked / unknown → reject
 * with reason. Without DB (host offline) → `no_host` — the UI shows retry (D10). The
 * real answer comes once the DB/host is reachable again.
 */
export async function reconnect(params: ReconnectParams): Promise<ReconnectResult> {
  if (params.database === undefined) return { success: false, reason: 'no_host' };
  const ok = await validateToken(params.database, params.token);
  return ok ? { success: true } : { success: false, reason: 'kicked' };
}

/**
 * One-time ping — no heartbeat (D10). Signals whether the host is reachable;
 * on false the UI shows a retry icon (see D10 offline state).
 * Without DB → false; with DB → SELECT 1 as a round-trip.
 */
export async function ping(database?: DatabaseLike): Promise<boolean> {
  if (database === undefined) return false;
  try {
    await database.select('SELECT 1 AS ok');
    return true;
  } catch {
    return false;
  }
}
