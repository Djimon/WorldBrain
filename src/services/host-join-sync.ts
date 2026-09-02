// M10-#387 (D24/D29, Decision 8): DB-less join/auth as a transport handshake.
//
// Why: The player client is DB-less (D29). Join/reconnect must NOT
// run as a shared DB — the truth (invite_codes / players / session_players)
// lives and is checked exclusively in the HOST DB. The player sends their
// request over the transport; only the host decides and, if valid, creates the
// active member (D24: auto-join, no approve gate).
//
// Flow (host-side):
//   join_request { code, displayName }      → check code against host DB; valid →
//     joinWithCode() creates session_players(status='active'), generates token →
//     join_response { ok:true, token, playerId } + immediately the initial snapshot
//     (presented map + tokens, #386). Invalid → join_response { ok:false }, NO DB entry.
//   reconnect_request { token }             → resolve token against host DB; active
//     member → join_response { ok:true, token(echo), playerId } + snapshot; otherwise ok:false.
//
// Mirrors the pattern of attachHostTokenSync: transport.onMessage → authorize
// against the DB → respond. The client never decides membership itself.
import type { DatabaseLike } from './entity-service';
import type { SessionTransport, TransportMessage, JoinResponsePayload } from './session-transport';
import { JOIN_REQUEST, RECONNECT_REQUEST, JOIN_RESPONSE, SYSTEM_TOKEN } from './session-transport';
import { joinWithCode, resolveCampaignForCode, resolvePlayerByToken } from './session-identity-service';

/**
 * Called after a successful join/reconnect to send the newly-active player their
 * initial scene. Injected by the caller (WorkspaceShell) so this session-core
 * handshake carries NO map-feature import — the presented-map snapshot is the
 * maps feature's contribution and is wired only when `feature('maps')` is on
 * (#412: keeps map-service/map-layer-service out of the main bundle at maps=false).
 */
export type AfterJoinHook = (playerId: string) => Promise<void>;

interface JoinRequestPayload {
  code?: unknown;
  displayName?: unknown;
}

interface ReconnectRequestPayload {
  token?: unknown;
}

/**
 * Host side: receive join/reconnect handshakes over the transport,
 * validate against the host DB, and respond with `join_response` (+ initial
 * snapshot on success). Analogous to `attachHostTokenSync` — wired alongside
 * it in the host effect.
 */
export function attachHostJoinSync(params: {
  transport: Pick<SessionTransport, 'onMessage' | 'send'>;
  database: DatabaseLike;
  campaignId: string;
  /** Sends the initial scene after a join/reconnect. Absent → no scene push (e.g. maps off). */
  onAfterJoin?: AfterJoinHook;
}): void {
  const { transport, database, campaignId, onAfterJoin } = params;
  transport.onMessage((msg: TransportMessage) => {
    if (msg.type === JOIN_REQUEST) {
      void handleJoinRequest(database, campaignId, transport, msg.payload as JoinRequestPayload, onAfterJoin);
    } else if (msg.type === RECONNECT_REQUEST) {
      void handleReconnectRequest(database, campaignId, transport, msg.payload as ReconnectRequestPayload, onAfterJoin);
    }
  });
}

async function handleJoinRequest(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  payload: JoinRequestPayload,
  onAfterJoin?: AfterJoinHook,
): Promise<void> {
  const code = typeof payload.code === 'string' ? payload.code : '';
  const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : '';

  // Pre-validation WITHOUT catching a joinWithCode() throw (AP-006): an
  // unknown/invalidated code or a code from a FOREIGN campaign is
  // rejected host-authoritatively here — no DB entry is created.
  const codeCampaign = code === '' ? null : await resolveCampaignForCode(database, code);
  if (codeCampaign === null || codeCampaign !== campaignId) {
    void transport.send(joinResponse({ ok: false, error: 'invalid_code' })).catch(() => { /* offline → discard */ });
    return;
  }

  // Valid → create active member (D24) + generate token (ground truth in the host DB).
  const { token, playerId } = await joinWithCode(database, { code, displayName });
  void transport.send(joinResponse({ ok: true, token, playerId })).catch(() => { /* offline → discard */ });
  // Immediately afterwards the initial scene (#386) — targeted at this player.
  await onAfterJoin?.(playerId);
}

async function handleReconnectRequest(
  database: DatabaseLike,
  campaignId: string,
  transport: Pick<SessionTransport, 'send'>,
  payload: ReconnectRequestPayload,
  onAfterJoin?: AfterJoinHook,
): Promise<void> {
  const token = typeof payload.token === 'string' ? payload.token : '';
  const member = token === '' ? null : await resolvePlayerByToken(database, token);
  if (member === null) {
    void transport.send(joinResponse({ ok: false, error: 'invalid_token' })).catch(() => { /* offline → discard */ });
    return;
  }
  // Active member → replay the same token (token replay, #387) + scene.
  void transport.send(joinResponse({ ok: true, token, playerId: member.playerId })).catch(() => { /* offline → discard */ });
  await onAfterJoin?.(member.playerId);
}

/** Builds the `join_response` envelope (system token, since the player is not yet/again addressable). */
function joinResponse(payload: JoinResponsePayload): TransportMessage {
  return { type: JOIN_RESPONSE, token: SYSTEM_TOKEN, payload: payload as unknown as Record<string, unknown> };
}
