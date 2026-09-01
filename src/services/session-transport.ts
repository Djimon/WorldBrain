// M10-S01 (#350) + M10-S02 (#351): Transport interface (rebuild).
// The renderer talks exclusively against this interface — the concrete
// implementation is WebRTC DataChannel (webrtc-transport.ts). There is
// NO HTTP/WS server (D-current-state point 1).
//
// Decision 8 (S02): EVERY message carries the player token. The host validates
// per message (not only at the handshake) via session-identity-service.
// validateToken — without a valid active token the message is discarded.

export interface TransportMessage {
  type: string;
  payload: Record<string, unknown>;
  /** Player token (S02 Decision 8): checked host-side per message.
   *  The DM/system sender may also use a marker here — for the
   *  real auth only hosted client messages matter. */
  token: string;
}

// M10-#387: Join/auth as a transport handshake. These type constants are the
// ONE source for the host side (host-join-sync) and the player side (PlayerJoinView) as well as
// the pre-auth exception in the transport gate (webrtc-transport).
export const JOIN_REQUEST = 'join_request';
export const RECONNECT_REQUEST = 'reconnect_request';
export const JOIN_RESPONSE = 'join_response';

/**
 * Pre-auth handshake types. A handshake is by definition pre-auth — the
 * sender still has (join) or again has (reconnect) no valid player token,
 * so it cannot pass the per-message token gate (Decision 8). These
 * types are exempt from the gate and are instead validated HOST-AUTHORITATIVELY by
 * `host-join-sync` (code against `invite_codes`, token against
 * `session_players`). ALL other messages stay fully gated.
 */
export const PRE_AUTH_MESSAGE_TYPES: ReadonlySet<string> = new Set([JOIN_REQUEST, RECONNECT_REQUEST]);

/** Envelope `token` placeholder for pre-auth handshake messages (the sender
 *  has no real token yet; but `validateIncomingMessage` requires a
 *  non-empty field). Irrelevant for auth — the gate skips them. */
export const HANDSHAKE_TOKEN = 'handshake';

/** System marker in the envelope `token` field for host-generated broadcasts/responses
 *  (DM/system sender; the recipient is not yet addressable by player token).
 *  ONE source for host-join-sync, presented-map-push, token-movement, visibility. */
export const SYSTEM_TOKEN = 'system-dm';

/** The host's response to join_request/reconnect_request (#387). On success it carries
 *  the (new or confirmed) player token + player_id; otherwise a reason. */
export type JoinResponsePayload =
  | { ok: true; token: string; playerId: string }
  | { ok: false; error: string };

export interface SessionTransport {
  /** Opens the peer connection (host: provide the DataChannel). */
  connect(): Promise<void>;
  /** Closes the peer connection — coupled to the campaign lifecycle. */
  close(): Promise<void>;
  /** Sends an already schema-conformant message. */
  send(msg: TransportMessage): Promise<void>;
  /**
   * Registers a receiver for host-side validated inputs.
   * MULTIPLE listeners are allowed (e.g. host: token-sync + join-sync on the same
   * transport; player: join handshake + client-store bridge) — every message
   * goes to ALL of them. Returns a disposer to unregister (#387).
   */
  onMessage(cb: (msg: TransportMessage) => void): () => void;
}

/**
 * Host-side schema validation of incoming messages (AC).
 * Invalid payloads → throw; the caller discards the message.
 */
export function validateIncomingMessage(raw: unknown): TransportMessage {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid message: must be a non-null object');
  }
  const obj = raw as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length !== 3 || !keys.includes('type') || !keys.includes('payload') || !keys.includes('token')) {
    throw new Error('Invalid message: must have exactly type, payload, and token fields');
  }
  if (typeof obj.type !== 'string') {
    throw new Error('Invalid message: type must be a string');
  }
  if (typeof obj.token !== 'string' || obj.token === '') {
    throw new Error('Invalid message: token must be a non-empty string');
  }
  if (obj.payload === null || typeof obj.payload !== 'object' || Array.isArray(obj.payload)) {
    throw new Error('Invalid message: payload must be a non-null object');
  }
  return obj as unknown as TransportMessage;
}
