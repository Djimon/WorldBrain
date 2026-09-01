// M10-#386 / D18 (host-authoritative): the host receives token-movement
// INTENTS from players (ClientAction over the transport), authorizes them,
// writes the GROUND TRUTH into the DB and broadcasts the result to everyone.
//
// Why: the DB-less client (D29) never holds the truth. A player sends
// "I want token X at (x,y)"; only the host decides and distributes.
// This lets the host correct (if it rejects, no delta arrives → the
// optimistic client movement is overwritten by the next host broadcast).
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage } from './session-transport';
import type { ClientAction } from './play-sync-protocol';
import { moveToken as authorizeMove, broadcastMovement } from './token-movement-service';
import { moveToken as persistTokenMove } from './map-token-service';

/** Player side: send a token-movement intent to the host. */
export function sendMoveIntent(
  transport: Pick<SessionTransport, 'send'>,
  params: { campaignId: string; senderPlayerId: string; tokenId: string; x: number; y: number; token?: string },
): void {
  const action: ClientAction = {
    type: 'client_action',
    actionKind: 'move_own_token',
    senderPlayerId: params.senderPlayerId,
    campaignId: params.campaignId,
    payload: { tokenId: params.tokenId, x: params.x, y: params.y },
    clientTime: new Date().toISOString(),
  };
  const msg: TransportMessage = {
    type: 'client_action',
    token: params.token ?? params.senderPlayerId,
    payload: action as unknown as Record<string, unknown>,
  };
  void transport.send(msg).catch(() => { /* fire-and-forget */ });
}

/**
 * Host side: receive token-movement intents, authorize them (the sender must be
 * an active member — the host checks the STATUS itself, does not trust the
 * client), persist ground truth and broadcast to everyone.
 */
export function attachHostTokenSync(params: {
  transport: Pick<SessionTransport, 'onMessage' | 'send'>;
  database: DatabaseLike;
  campaignId: string;
}): void {
  const { transport, database, campaignId } = params;
  transport.onMessage((msg: TransportMessage) => {
    if (msg.type !== 'client_action') return;
    const action = msg.payload as unknown as ClientAction;
    if (action.actionKind !== 'move_own_token') return;
    const p = action.payload as { tokenId?: string; x?: number; y?: number };
    if (typeof p.tokenId !== 'string' || typeof p.x !== 'number' || typeof p.y !== 'number') return;
    void handleMoveIntent(database, campaignId, transport, action.senderPlayerId, p.tokenId, p.x, p.y);
  });
}

async function handleMoveIntent(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  senderPlayerId: string,
  tokenId: string,
  x: number,
  y: number,
): Promise<void> {
  // Host determines the status ITSELF (no trust in client-provided data).
  const rows = await database.select<{ status: string }>(
    'SELECT status FROM session_players WHERE campaign_id = ? AND player_id = ?',
    [campaignId, senderPlayerId],
  );
  const status = rows[0]?.status ?? 'unknown';
  const auth = authorizeMove({ tokenId, playerId: senderPlayerId, playerStatus: status, x, y });
  if (!auth.success) return; // kicked/unknown → no DB write, no broadcast

  // Ground truth: first persist …
  await persistTokenMove(database, tokenId, x, y);
  // … then distribute to everyone (incl. back to the moving player).
  broadcastMovement({ campaignId, tokenId, x, y }, transport);
}
