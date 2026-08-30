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
import type { SessionTransport, TransportMessage } from './session-transport';
import type { PlayClientStore } from './play-client-store';

// Systemweit-Token für DM-/Host-Broadcasts (wie im Visibility-Broadcaster).
const SYSTEM_TOKEN = 'system-dm';

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

/** Baut das Token-Bewegungs-Delta (kind:'token', op:'update'). */
export function buildMovementDelta(
  params: { campaignId: string; tokenId: string; x: number; y: number; serverTime?: string },
): Delta {
  return {
    type: 'delta',
    campaignId: params.campaignId,
    op: 'update',
    kind: 'token',
    id: params.tokenId,
    data: { x: params.x, y: params.y },
    serverTime: params.serverTime ?? new Date().toISOString(),
  };
}

/**
 * Live-Push (Host→alle): verteilt eine autorisierte Token-Bewegung über den
 * Host-Push-Pfad (SessionTransport, #373). Token-Bewegung ist NICHT
 * per-Spieler-gefiltert — sie ist für alle sichtbar (D18/D20), daher ein
 * einfacher Broadcast. Das Delta reist als TransportMessage
 * (type:'delta', payload=Delta). Gibt das gesendete Delta zurück.
 */
export function broadcastMovement(
  params: { campaignId: string; tokenId: string; x: number; y: number; serverTime?: string },
  transport: Pick<SessionTransport, 'send'>,
): Delta {
  const delta = buildMovementDelta(params);
  const msg: TransportMessage = {
    type: 'delta',
    token: SYSTEM_TOKEN,
    payload: delta as unknown as Record<string, unknown>,
  };
  void transport.send(msg).catch(() => { /* offline → verwerfen (fire-and-forget) */ });
  return delta;
}

/**
 * Client-Seite (D29, DB-los): wendet eine eingehende Token-Bewegungs-
 * TransportMessage auf den transport-gespeisten Store an. Nur `delta`-
 * Nachrichten mit kind:'token' werden angewandt; alles andere ignoriert.
 * Gibt true zurück, wenn eine Token-Bewegung angewandt wurde.
 */
export function applyMovementMessage(msg: TransportMessage, store: PlayClientStore): boolean {
  if (msg.type !== 'delta') return false;
  const delta = msg.payload as unknown as Delta;
  if (delta.kind !== 'token') return false;
  store.applyDelta(delta);
  return true;
}
