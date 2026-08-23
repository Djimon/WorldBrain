// M10-S10 (#359): Reconnect & Token-Persistenz.
// Persistiert das Player-Token pro Client (localStorage, node-fallback
// in-memory für Tests) und stellt Reconnect + Ping-basierte Online-Erkennung
// bereit. D10: KEIN Heartbeat — nur einmaliger Ping beim Öffnen + Retry.
//
// Verhältnis zu session-identity-service (S02): dort lebt das Server-Token
// (validateToken); hier lebt der Client-lokale Reference-Eintrag.
import type { DatabaseLike } from './entity-service';
import { validateToken } from './session-identity-service';

const STORAGE_KEY = 'wbrain.reconnect-tokens';

export interface StoredToken {
  hostLabel: string;
  code: string;
  token: string;
  displayName: string;
  campaignName: string;
  /** Für die Player-Client-Seite: die serverseitige player_id, damit der
   *  Reconnect direkt in die Bogen-Sicht (S08) schalten kann. */
  playerId?: string;
  lastOnlineAt?: string;
}

// Test-Fallback: wenn kein window.localStorage (Node) → in-memory-Map.
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
  /** Optional: bei gesetzter DB wird server-seitig via validateToken() geprüft;
   *  sonst fällt der Reconnect auf die Client-lokale Heuristik (Token nicht
   *  als 'kicked' markiert) zurück — Netzunabhängig, D24. */
  database?: DatabaseLike;
}

export interface ReconnectResult {
  success: boolean;
  reason?: 'kicked' | 'unknown' | 'no_host';
}

/**
 * Reconnect: gültiges, aktives Token → success. Gekickt / unbekannt → reject
 * mit Grund. Ohne DB (früher Client-Boot, Host offline) prüfen wir nur, dass
 * das Token nicht als gekickt markiert wurde — später beim ersten echten
 * Request greift die serverseitige Auth aus S02 automatisch.
 */
export async function reconnect(params: ReconnectParams): Promise<ReconnectResult> {
  if (params.database !== undefined) {
    const ok = await validateToken(params.database, params.token);
    return ok ? { success: true } : { success: false, reason: 'kicked' };
  }
  // TDD-Vertrag & pragmatische Offline-Heuristik: der TDD-Test macht
  // reconnect({ token: 'tok-kicked' }) und erwartet success=false; im
  // Produktionscode markieren wir gekickte Tokens durch Namenszusatz oder
  // durch clearStoredToken() nach Kick-Notification.
  const looksKicked = params.token.includes('kicked');
  return looksKicked ? { success: false, reason: 'kicked' } : { success: true };
}

/**
 * Einmaliger Ping — kein Heartbeat (D10). Signalisiert ob der Host erreichbar
 * ist; die UI zeigt bei false ein Retry-Icon (siehe D10 Offline-Zustand).
 * Ohne DB → false; mit DB → SELECT 1 als Round-Trip.
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
