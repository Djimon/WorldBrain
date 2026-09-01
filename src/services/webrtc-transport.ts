// M10-S01 (#350) + S11 (#367): WebRTC DataChannel implementation of the
// SessionTransport. The host peer is coupled to a hosted campaign
// (D23). No HTTP/WS server.
//
// S11: For remote peer discovery the transport is composed with a #368 adapter.
// `attachSignaling({ appId, roomId, peerLabel })` calls
// `createSignalingAdapter(...)`, exchanges SDP offer/answer + ICE candidates
// over the broker, and the transport then takes over the P2P connection.
// The broker sees only SDP/ICE — no game data.
//
// STUN (Google + Cloudflare + Trystero-internal) is enough for NAT traversal;
// NO TURN in V1 → ~10-20% strict symmetric NATs fail with `onError`.

import { validateIncomingMessage, PRE_AUTH_MESSAGE_TYPES } from './session-transport';
import type { SessionTransport, TransportMessage } from './session-transport';
import type { DatabaseLike } from './entity-service';
import { validateToken } from './session-identity-service';
import { createSignalingAdapter, connectWithFallback, STRATEGY_ORDER } from './signaling';
import type { AdapterHandle, AdapterKey } from './signaling';

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export interface WebRtcTransportOptions {
  /**
   * The campaign whose host peer this transport instance provides.
   * The DataChannel is named after it, and the lifecycle is coupled
   * to it: no connect() without a campaign, close() at campaign end.
   */
  campaignId: string;
  iceServers?: RTCIceServer[];
  /**
   * S02 Decision 8: the token is validated per message (not only at the
   * handshake). The host sets a callback here that returns true if
   * the token still belongs to an active (not kicked) member.
   * Not set (client side) → no auth check; the server side
   * enforces it.
   */
  authenticate?: (token: string) => Promise<boolean> | boolean;
}

export interface SignalingAttachOpts {
  /** Broker namespace (per-host, from `deriveAppId`). */
  appId: string;
  /** Broker room (= campaign, opaque to the broker). */
  roomId: string;
  /** A|B — which role this side plays in the rendezvous. */
  peerLabel: 'A' | 'B';
  /** Adapter choice. Default 'nostr' (Spike primary). */
  strategy?: AdapterKey;
  /** Diagnostics sink (broker-internal events). */
  onDiagnostic?: (msg: string) => void;
  /** NAT/broker error → user-visible message. */
  onError?: (err: Error) => void;
  /** Fires when the broker has managed peer mediation (before DataChannel open). */
  onConnected?: () => void;
}

export class WebRtcTransport implements SessionTransport {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  // M10-#387: MULTIPLE receivers (host: token-sync + join-sync; player: join
  // handshake + store bridge). A single handler let the second overwrite the
  // first → dead handler. `inbox` is a bounded receive-replay buffer:
  // a listener joining LATER (e.g. the store bridge after the join)
  // gets the already-arrived messages (e.g. the initial snapshot)
  // replayed, instead of losing them.
  private handlers: Array<(msg: TransportMessage) => void> = [];
  private inbox: TransportMessage[] = [];
  private static readonly MAX_INBOX = 64;
  private signalingHandle: AdapterHandle | null = null;
  // M10-#387: Outbound buffer. `onConnected` fires at the broker rendezvous —
  // BEFORE the DataChannel opens; an early send() (e.g. join_request) must
  // wait until the channel is open, instead of throwing. Buffered messages
  // are flushed in order on `onopen` (bounded against a channel that never
  // opens).
  private outbox: TransportMessage[] = [];
  private static readonly MAX_OUTBOX = 64;

  constructor(private readonly options: WebRtcTransportOptions) {}

  async connect(): Promise<void> {
    if (this.pc !== null) return;
    const iceServers = this.options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.pc = new RTCPeerConnection({ iceServers });
    this.channel = this.pc.createDataChannel(`campaign-${this.options.campaignId}`);
    this.wireChannel(this.channel);
    // Player peers establish the DataChannel (ondatachannel) — on the host
    // we intercept every incoming new connection and replace the local
    // channel handle (single-channel model in the DataChannel duplex).
    this.pc.ondatachannel = (ev) => {
      this.channel = ev.channel;
      this.wireChannel(ev.channel);
    };
  }

  async close(): Promise<void> {
    this.channel?.close();
    this.pc?.close();
    if (this.signalingHandle !== null) await this.signalingHandle.close();
    this.channel = null;
    this.pc = null;
    this.handlers = [];
    this.inbox = [];
    this.signalingHandle = null;
    this.outbox = []; // never-opened channel → discard buffered messages

  }

  /**
   * S11: Attach the signaling adapter (#368) to the transport — via the
   * fallback orchestrator (`connectWithFallback`), so that the fixed chain
   * Nostr → MQTT → BitTorrent → PeerJS runs automatically when a
   * strategy acts up. Success = `onOpen` at the first working broker.
   *
   * The broker sees only SDP/ICE — no game data (E2E via WebRTC).
   * With a strict symmetric NAT the ICE handshake fails despite STUN and
   * fires `onError` (no TURN in V1).
   *
   * `opts.onConnected` fires when the broker has mediated both peers —
   * the actual P2P DataChannel opening follows asynchronously afterward.
   */
  async attachSignaling(opts: SignalingAttachOpts): Promise<void> {
    if (this.pc === null) throw new Error('Transport not connected — call connect() first');
    const pc = this.pc;
    // Accept only real AdapterKeys; if strategy is set, single-shot,
    // otherwise the full fallback chain.
    const order: AdapterKey[] = opts.strategy !== undefined
      ? [opts.strategy]
      : STRATEGY_ORDER;
    // Share the local peer's ICE candidates via the broker (the handler must
    // be SET before the adapter fires open — otherwise early
    // candidates are lost; hence here before connectWithFallback).
    pc.onicecandidate = (ev) => {
      if (ev.candidate !== null) {
        this.signalingHandle?.send({ kind: 'ice', candidate: ev.candidate.toJSON() });
      }
    };
    this.signalingHandle = await connectWithFallback({
      appId: opts.appId,
      roomId: opts.roomId,
      peerLabel: opts.peerLabel,
      order,
      onOpen: () => {
        opts.onDiagnostic?.('[signaling] peer joined broker');
        opts.onConnected?.();
        // A initiates the offer after open; B waits for the offer via onMessage.
        if (opts.peerLabel === 'A') {
          void pc.createOffer().then(async (offer) => {
            await pc.setLocalDescription(offer);
            this.signalingHandle?.send({ kind: 'offer', sdp: offer.sdp, type: offer.type });
          }).catch((e) => opts.onError?.(new Error(`Offer failed: ${e instanceof Error ? e.message : String(e)}`)));
        }
      },
      onDiagnostic: opts.onDiagnostic,
      onMessage: (from, payload) => {
        void from;
        void this.handleSignalingPayload(pc, payload, opts.onError);
      },
      onError: (err) => {
        // Broker/NAT error → user-visible message. Symmetric NAT fails
        // here despite STUN (no TURN in V1) — the message must name that.
        opts.onError?.(new Error(`NAT/Signaling failed: ${err.message}`));
      },
    });
  }

  // Legacy direct adapter for tests that want to bypass the fallback chain.
  // Uses createSignalingAdapter directly — no orchestrator.
  async attachSingleAdapter(key: AdapterKey, opts: Omit<SignalingAttachOpts, 'strategy'>): Promise<void> {
    if (this.pc === null) throw new Error('Transport not connected');
    void createSignalingAdapter(key, {
      appId: opts.appId, roomId: opts.roomId, peerLabel: opts.peerLabel,
      onOpen: () => opts.onConnected?.(),
      onMessage: () => {},
      onError: (err) => opts.onError?.(err),
      onDiagnostic: opts.onDiagnostic,
    });
  }

  private async handleSignalingPayload(
    pc: RTCPeerConnection,
    payload: unknown,
    onError: ((err: Error) => void) | undefined,
  ): Promise<void> {
    if (payload === null || typeof payload !== 'object') return;
    const msg = payload as { kind?: string; sdp?: string; type?: RTCSdpType; candidate?: RTCIceCandidateInit };
    try {
      if (msg.kind === 'offer' && msg.sdp !== undefined && msg.type !== undefined) {
        await pc.setRemoteDescription({ type: msg.type, sdp: msg.sdp });
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signalingHandle?.send({ kind: 'answer', sdp: answer.sdp, type: answer.type });
      } else if (msg.kind === 'answer' && msg.sdp !== undefined && msg.type !== undefined) {
        await pc.setRemoteDescription({ type: msg.type, sdp: msg.sdp });
      } else if (msg.kind === 'ice' && msg.candidate !== undefined) {
        await pc.addIceCandidate(msg.candidate);
      }
    } catch (e) {
      onError?.(new Error(`Signaling payload rejected: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  async send(msg: TransportMessage): Promise<void> {
    if (this.channel !== null && this.channel.readyState === 'open') {
      this.channel.send(JSON.stringify(msg));
      return;
    }
    // Channel not (yet) open → buffer instead of throw. Per the SessionTransport
    // contract, `send()` promises delivery, not immediate transmission; the flush
    // on `onopen` fulfills the promise. Bounded: on overflow, the oldest goes out.
    if (this.outbox.length >= WebRtcTransport.MAX_OUTBOX) this.outbox.shift();
    this.outbox.push(msg);
  }

  /** Send buffered messages in order over the open channel. */
  private flushOutbox(ch: RTCDataChannel): void {
    if (ch.readyState !== 'open' || this.outbox.length === 0) return;
    const pending = this.outbox;
    this.outbox = [];
    for (const msg of pending) ch.send(JSON.stringify(msg));
  }

  onMessage(cb: (msg: TransportMessage) => void): () => void {
    this.handlers.push(cb);
    // Receive replay: replay already-arrived messages to the new listener
    // (e.g. the store bridge gets the join snapshot that arrived BEFORE its
    // attach). Idempotent consumers (applySnapshot/applyDelta) tolerate this.
    for (const msg of this.inbox) cb(msg);
    return () => {
      const i = this.handlers.indexOf(cb);
      if (i !== -1) this.handlers.splice(i, 1);
    };
  }

  /** Buffer an incoming message (bounded) + distribute to ALL listeners. */
  private dispatchIncoming(msg: TransportMessage): void {
    if (this.inbox.length >= WebRtcTransport.MAX_INBOX) this.inbox.shift();
    this.inbox.push(msg);
    // Copy, in case a handler unregisters/registers during the iteration.
    for (const h of [...this.handlers]) h(msg);
  }

  /**
   * Convenience: builds a host transport whose authenticator hangs directly on
   * validateToken(db). This lets the app wire the per-message auth
   * (S02 Decision 8) with one line when setting up the server.
   */
  static host(campaignId: string, database: DatabaseLike, iceServers?: RTCIceServer[]): WebRtcTransport {
    return new WebRtcTransport({
      campaignId,
      iceServers,
      authenticate: (tok) => validateToken(database, tok),
    });
  }

  private wireChannel(ch: RTCDataChannel): void {
    // As soon as the channel is open, flush buffered messages (#387). If it is
    // already open at wiring time (race), flush immediately.
    ch.onopen = () => this.flushOutbox(ch);
    if (ch.readyState === 'open') this.flushOutbox(ch);
    ch.onmessage = (ev: MessageEvent) => {
      // Every incoming message is schema-validated BEFORE processing
      // (AC). Invalid payloads are discarded without calling the handler.
      let parsed: TransportMessage;
      try {
        parsed = validateIncomingMessage(JSON.parse(ev.data as string) as unknown);
      } catch {
        return;
      }
      // M10-#387: pre-auth handshake messages (join_request/reconnect_request)
      // bypass the token gate — the sender still/again has no valid token.
      // They are validated host-authoritatively by host-join-sync (code against
      // invite_codes, token against session_players), not here. All other
      // messages stay fully gated (Decision 8, secure-by-default).
      if (PRE_AUTH_MESSAGE_TYPES.has(parsed.type)) {
        this.dispatchIncoming(parsed);
        return;
      }
      // S02 Decision 8: per-message token validation. If an authenticator
      // is set (host side), forward to the handler only after OK.
      const auth = this.options.authenticate;
      if (auth) {
        void Promise.resolve(auth(parsed.token)).then((ok) => {
          if (ok) this.dispatchIncoming(parsed);
          /* not ok → message discarded; no channel feedback (the client should
             not know whether the token exists or was kicked) */
        }).catch(() => { /* fail-closed: discard */ });
        return;
      }
      this.dispatchIncoming(parsed);
    };
  }
}
