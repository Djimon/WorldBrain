// M10-S18 (#366, D18): Token movement in multiplayer.
//
// Host-side authorization + broadcast layer (separate from the pure
// DB persistence in map-token-service). V1 rule (D18, decided 2026-08):
// - Default OPEN: EVERY active player (status='active', D24) moves EVERY
//   token. NO DM lock in V1 (a later nice-to-have).
// - PURELY VISUAL: no enforced grid/range check — arbitrary
//   coordinates are allowed, rule compliance by agreement.
// - Only kicked/inactive players are not allowed to move (token lock).
// The movement is pushed live to everyone as a normal `token` update delta.
import type { Delta } from './play-sync-protocol';
import type { SessionTransport, TransportMessage } from './session-transport';
import { SYSTEM_TOKEN } from './session-transport';
import type { PlayClientStore } from './play-client-store';

export type PlayerStatus = 'active' | 'kicked' | 'inactive' | string;

export interface MoveTokenParams {
  tokenId: string;
  playerId: string;
  /** Membership status of the mover (D24). Only 'active' may move. */
  playerStatus: PlayerStatus;
  x: number;
  y: number;
}

export interface MoveTokenResult {
  success: boolean;
  /** Why rejected (only when success=false). */
  reason?: 'not-active';
}

/**
 * Authorizes a token movement. V1: every ACTIVE player may move any token
 * (default open, no lock). No grid/range check — arbitrary
 * coordinates are valid (purely visual). Only non-active (e.g. kicked)
 * players are rejected.
 */
export function moveToken(params: MoveTokenParams): MoveTokenResult {
  if (params.playerStatus !== 'active') {
    return { success: false, reason: 'not-active' };
  }
  // Purely visual: x/y are NOT checked against grid/range.
  return { success: true };
}

/** Builds the token-movement delta (kind:'token', op:'update'). */
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
 * Live push (host→all): distributes an authorized token movement over the
 * host push path (SessionTransport, #373). Token movement is NOT
 * per-player filtered — it is visible to everyone (D18/D20), hence a
 * simple broadcast. The delta travels as a TransportMessage
 * (type:'delta', payload=Delta). Returns the sent delta.
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
  void transport.send(msg).catch(() => { /* offline → discard (fire-and-forget) */ });
  return delta;
}

/**
 * Client side (D29, DB-less): applies an incoming token-movement
 * TransportMessage to the transport-fed store. Only `delta`
 * messages with kind:'token' are applied; everything else is ignored.
 * Returns true if a token movement was applied.
 */
export function applyMovementMessage(msg: TransportMessage, store: PlayClientStore): boolean {
  if (msg.type !== 'delta') return false;
  const delta = msg.payload as unknown as Delta;
  if (delta.kind !== 'token') return false;
  store.applyDelta(delta);
  return true;
}
