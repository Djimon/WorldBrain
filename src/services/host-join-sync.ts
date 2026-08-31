// M10-#387 (D24/D29, Decision 8): DB-loser Join/Auth als Transport-Handshake.
//
// Warum: Der Player-Client ist DB-los (D29). Beitritt/Reconnect dürfen NICHT
// als geteilte DB laufen — die Wahrheit (invite_codes / players / session_players)
// lebt und wird ausschließlich in der HOST-DB geprüft. Der Spieler schickt seinen
// Wunsch über den Transport; erst der Host entscheidet und legt bei Gültigkeit das
// aktive Mitglied an (D24: Auto-Join, kein Approve-Gate).
//
// Ablauf (host-seitig):
//   join_request { code, displayName }      → Code gegen Host-DB prüfen; gültig →
//     joinWithCode() legt session_players(status='active') an, erzeugt Token →
//     join_response { ok:true, token, playerId } + unmittelbar der Initial-Snapshot
//     (präsentierte Karte + Tokens, #386). Ungültig → join_response { ok:false }, KEIN DB-Eintrag.
//   reconnect_request { token }             → Token gegen Host-DB auflösen; aktives
//     Mitglied → join_response { ok:true, token(echo), playerId } + Snapshot; sonst ok:false.
//
// Spiegelt das Muster von attachHostTokenSync: transport.onMessage → gegen die DB
// autorisieren → antworten. Der Client entscheidet nie selbst über Zugehörigkeit.
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage, JoinResponsePayload } from './session-transport';
import { JOIN_REQUEST, RECONNECT_REQUEST, JOIN_RESPONSE, SYSTEM_TOKEN } from './session-transport';
import { joinWithCode, resolveCampaignForCode, resolvePlayerByToken } from './session-identity-service';
import { pushPresentedMapSnapshot } from './presented-map-push';

interface JoinRequestPayload {
  code?: unknown;
  displayName?: unknown;
}

interface ReconnectRequestPayload {
  token?: unknown;
}

/**
 * Host-Seite: Beitritts-/Reconnect-Handshakes über den Transport entgegennehmen,
 * gegen die Host-DB validieren und mit `join_response` (+ Initial-Snapshot bei
 * Erfolg) antworten. Analog `attachHostTokenSync` — neben diesem im Host-Effekt
 * verdrahtet.
 */
export function attachHostJoinSync(params: {
  transport: Pick<SessionTransport, 'onMessage' | 'send'>;
  database: DatabaseLike;
  campaignId: string;
}): void {
  const { transport, database, campaignId } = params;
  transport.onMessage((msg: TransportMessage) => {
    if (msg.type === JOIN_REQUEST) {
      void handleJoinRequest(database, campaignId, transport, msg.payload as JoinRequestPayload);
    } else if (msg.type === RECONNECT_REQUEST) {
      void handleReconnectRequest(database, campaignId, transport, msg.payload as ReconnectRequestPayload);
    }
  });
}

async function handleJoinRequest(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  payload: JoinRequestPayload,
): Promise<void> {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';

  // Vorab-Validierung OHNE joinWithCode()-Throw abzufangen (AP-006): ein
  // unbekannter/invalidierter Code oder ein Code einer FREMDEN Campaign wird
  // hier host-autoritativ abgelehnt — kein DB-Eintrag entsteht.
  const codeCampaign = code === '' ? null : await resolveCampaignForCode(database, code);
  if (codeCampaign === null || codeCampaign !== campaignId) {
    void transport.send(joinResponse({ ok: false, error: 'invalid_code' })).catch(() => { /* offline → verwerfen */ });
    return;
  }

  // Gültig → aktives Mitglied anlegen (D24) + Token erzeugen (Ground Truth in der Host-DB).
  const { token, playerId } = await joinWithCode(database, { code, displayName });
  void transport.send(joinResponse({ ok: true, token, playerId })).catch(() => { /* offline → verwerfen */ });
  // Unmittelbar danach der Initial-Snapshot (#386) — gezielt für diesen Spieler.
  await pushSnapshot(database, campaignId, transport, playerId);
}

async function handleReconnectRequest(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  payload: ReconnectRequestPayload,
): Promise<void> {
  const token = typeof payload.token === 'string' ? payload.token : '';
  const member = token === '' ? null : await resolvePlayerByToken(database, token);
  if (member === null) {
    void transport.send(joinResponse({ ok: false, error: 'invalid_token' })).catch(() => { /* offline → verwerfen */ });
    return;
  }
  // Aktives Mitglied → dasselbe Token zurückspielen (Token-Replay, #387) + Snapshot.
  void transport.send(joinResponse({ ok: true, token, playerId: member.playerId })).catch(() => { /* offline → verwerfen */ });
  await pushSnapshot(database, campaignId, transport, member.playerId);
}

/** Baut das `join_response`-Envelope (System-Token, da der Spieler noch/wieder nicht adressierbar ist). */
function joinResponse(payload: JoinResponsePayload): TransportMessage {
  return { type: JOIN_RESPONSE, token: SYSTEM_TOKEN, payload: payload as unknown as Record<string, unknown> };
}

/** Initial-Snapshot der präsentierten Karte für genau diesen Empfänger (#386). */
async function pushSnapshot(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  playerId: string,
): Promise<void> {
  await pushPresentedMapSnapshot({ database, campaignId, transport, recipientPlayerId: playerId });
}
