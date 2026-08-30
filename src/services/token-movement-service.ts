// M10-S18 (#366, D18): Token-Bewegung im Multiplayer.
//
// Host-seitige Autorisierungs- + Broadcast-Schicht (getrennt von der reinen
// DB-Persistenz in map-token-service). V1-Regel (D18, entschieden 2026-08):
// - Default OFFEN: JEDER aktive Spieler (status='active', D24) bewegt JEDEN
//   Token. KEIN DM-Lock in V1 (spätere Kür).
// - REIN VISUELL: keine erzwungene Grid-/Reichweiten-Prüfung — beliebige
//   Koordinaten sind erlaubt, Regel-Einhaltung per Absprache.
// - Nur gekickte/inaktive Spieler dürfen nicht bewegen (Token-Sperre).
// Die Bewegung wird als normales `token`-Update-Delta live an alle gepusht.
import type { Delta } from './play-sync-protocol';

export type PlayerStatus = 'active' | 'kicked' | 'inactive' | string;

export interface MoveTokenParams {
  tokenId: string;
  playerId: string;
  /** Mitglieds-Status des Bewegers (D24). Nur 'active' darf bewegen. */
  playerStatus: PlayerStatus;
  x: number;
  y: number;
}

export interface MoveTokenResult {
  success: boolean;
  /** Warum abgelehnt (nur bei success=false). */
  reason?: 'not-active';
}

/**
 * Autorisiert eine Token-Bewegung. V1: jeder AKTIVE Spieler darf jeden Token
 * bewegen (Default offen, kein Lock). Kein Grid-/Reichweiten-Check — beliebige
 * Koordinaten sind gültig (rein visuell). Nur nicht-aktive (z.B. gekickte)
 * Spieler werden abgelehnt.
 */
export function moveToken(params: MoveTokenParams): MoveTokenResult {
  if (params.playerStatus !== 'active') {
    return { success: false, reason: 'not-active' };
  }
  // Rein visuell: x/y werden NICHT gegen Grid/Reichweite geprüft.
  return { success: true };
}

/**
 * Baut das Live-Push-Delta für eine autorisierte Token-Bewegung (kind:'token',
 * op:'update'). Wird an alle aktiven Empfänger verteilt (Token-Bewegung ist
 * nicht per-Spieler-gefiltert — sie ist für alle sichtbar, D18/D20). Der
 * optionale `send`-Callback verdrahtet den Transport (S01); ohne ihn liefert
 * die Funktion nur das Delta zurück (test-/consumer-freundlich).
 */
export function broadcastMovement(
  params: { campaignId: string; tokenId: string; x: number; y: number; serverTime?: string },
  send?: (delta: Delta) => void,
): Delta {
  const delta: Delta = {
    type: 'delta',
    campaignId: params.campaignId,
    op: 'update',
    kind: 'token',
    id: params.tokenId,
    data: { x: params.x, y: params.y },
    serverTime: params.serverTime ?? new Date().toISOString(),
  };
  send?.(delta);
  return delta;
}
