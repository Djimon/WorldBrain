// M10-#386 / D18 (host-authoritative): der Host empfängt Token-Bewegungs-
// INTENTS der Spieler (ClientAction über den Transport), autorisiert sie,
// schreibt die GROUND TRUTH in die DB und broadcastet das Ergebnis an alle.
//
// Warum: der DB-lose Client (D29) hält nie die Wahrheit. Ein Spieler schickt
// „ich will Token X nach (x,y)"; erst der Host entscheidet und verteilt.
// Damit kann der Host korrigieren (lehnt er ab, kommt kein Delta → die
// optimistische Client-Bewegung wird vom nächsten Host-Broadcast überschrieben).
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage } from './session-transport';
import type { ClientAction } from './play-sync-protocol';
import { moveToken as authorizeMove, broadcastMovement } from './token-movement-service';
import { moveToken as persistTokenMove } from './map-token-service';

/** Player-Seite: einen Token-Bewegungs-Intent an den Host schicken. */
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
 * Host-Seite: Token-Bewegungs-Intents entgegennehmen, autorisieren (Sender muss
 * aktives Mitglied sein — der Host prüft den STATUS selbst, traut dem Client
 * nicht), Ground-Truth persistieren und an alle broadcasten.
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
  // Host ermittelt den Status SELBST (kein Vertrauen in Client-Angaben).
  const rows = await database.select<{ status: string }>(
    'SELECT status FROM session_players WHERE campaign_id = ? AND player_id = ?',
    [campaignId, senderPlayerId],
  );
  const status = rows[0]?.status ?? 'unknown';
  const auth = authorizeMove({ tokenId, playerId: senderPlayerId, playerStatus: status, x, y });
  if (!auth.success) return; // gekickt/unbekannt → kein DB-Write, kein Broadcast

  // Ground truth: erst persistieren …
  await persistTokenMove(database, tokenId, x, y);
  // … dann an alle verteilen (inkl. zurück an den bewegenden Spieler).
  broadcastMovement({ campaignId, tokenId, x, y }, transport);
}
