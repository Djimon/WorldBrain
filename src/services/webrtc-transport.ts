// M10-S01 (#350) + S11 (#367): WebRTC-DataChannel-Implementierung des
// SessionTransport. Host-Peer wird an eine gehostete Campaign gekoppelt
// (D23). Kein HTTP/WS-Server.
//
// S11: Für Remote-Peer-Discovery wird der Transport mit einem #368-Adapter
// komponiert. `attachSignaling({ appId, roomId, peerLabel })` ruft
// `createSignalingAdapter(...)` auf, tauscht SDP-Offer/Answer + ICE-Kandidaten
// über den Broker aus, und der Transport übernimmt danach die P2P-Verbindung.
// Broker sieht nur SDP/ICE — keine Spieldaten.
//
// STUN (Google + Cloudflare + Trystero-intern) reicht für NAT-Traversal;
// KEIN TURN in V1 → ~10-20% strenge Symmetric-NATs scheitern mit `onError`.

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
   * Die Campaign, deren Host-Peer diese Transport-Instanz bereitstellt.
   * Der DataChannel wird nach ihr benannt, und der Lebenszyklus ist an sie
   * gekoppelt: kein connect() ohne Campaign, close() bei Campaign-Ende.
   */
  campaignId: string;
  iceServers?: RTCIceServer[];
  /**
   * S02 Decision 8: pro Nachricht wird das Token validiert (nicht nur beim
   * Handshake). Der Host setzt hier einen Callback, der true zurückgibt wenn
   * das Token noch zu einem aktiven (nicht gekickten) Mitglied gehört.
   * Nicht gesetzt (Client-Seite) → keine Auth-Prüfung; die Server-Seite
   * hört auf.
   */
  authenticate?: (token: string) => Promise<boolean> | boolean;
}

export interface SignalingAttachOpts {
  /** Broker-Namespace (per-Host, aus `deriveAppId`). */
  appId: string;
  /** Broker-Room (= Campaign, opak für den Broker). */
  roomId: string;
  /** A|B — welche Rolle diese Seite im Rendezvous spielt. */
  peerLabel: 'A' | 'B';
  /** Adapter-Wahl. Default 'nostr' (Spike-primär). */
  strategy?: AdapterKey;
  /** Diagnose-Senke (broker-interne Events). */
  onDiagnostic?: (msg: string) => void;
  /** NAT-/Broker-Fehler → User-sichtbare Meldung. */
  onError?: (err: Error) => void;
  /** Feuert wenn Broker Peer-Vermittlung geschafft hat (vor DataChannel-open). */
  onConnected?: () => void;
}

export class WebRtcTransport implements SessionTransport {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  // M10-#387: MEHRERE Empfänger (Host: token-sync + join-sync; Player: Join-
  // Handshake + Store-Bridge). Single-Handler ließ den zweiten den ersten
  // überschreiben → toter Handler. `inbox` ist ein bounded Receive-Replay-Puffer:
  // ein SPÄTER dazukommender Listener (z.B. die Store-Bridge nach dem Join)
  // bekommt die bereits eingetroffenen Nachrichten (z.B. den Initial-Snapshot)
  // nachgespielt, statt sie zu verlieren.
  private handlers: Array<(msg: TransportMessage) => void> = [];
  private inbox: TransportMessage[] = [];
  private static readonly MAX_INBOX = 64;
  private signalingHandle: AdapterHandle | null = null;
  // M10-#387: Ausgangs-Puffer. `onConnected` feuert beim Broker-Rendezvous —
  // VOR der DataChannel-Öffnung; ein früher send() (z.B. join_request) muss
  // warten bis der Kanal offen ist, statt zu werfen. Gepufferte Nachrichten
  // werden bei `onopen` in Reihenfolge geflusht (bounded gegen einen nie
  // öffnenden Kanal).
  private outbox: TransportMessage[] = [];
  private static readonly MAX_OUTBOX = 64;

  constructor(private readonly options: WebRtcTransportOptions) {}

  async connect(): Promise<void> {
    if (this.pc !== null) return;
    const iceServers = this.options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.pc = new RTCPeerConnection({ iceServers });
    this.channel = this.pc.createDataChannel(`campaign-${this.options.campaignId}`);
    this.wireChannel(this.channel);
    // Player-Peers stellen den DataChannel her (ondatachannel) — beim Host
    // greifen wir jede eingehende Neuverbindung ab und ersetzen den lokalen
    // Kanal-Handle (Single-Channel-Modell im DataChannel-Duplex).
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
    this.outbox = []; // nie geöffneter Kanal → gepufferte Nachrichten verwerfen

  }

  /**
   * S11: Signaling-Adapter (#368) an den Transport hängen — über den
   * Fallback-Orchestrator (`connectWithFallback`), sodass die feste Kette
   * Nostr → MQTT → BitTorrent → PeerJS automatisch durchläuft, wenn eine
   * Strategie zickt. Erfolg = `onOpen` beim ersten funktionierenden Broker.
   *
   * Der Broker sieht nur SDP/ICE — keine Spieldaten (E2E via WebRTC).
   * Bei strenger Symmetric-NAT scheitert die ICE-Handshake trotz STUN und
   * feuert `onError` (kein TURN in V1).
   *
   * `opts.onConnected` feuert wenn der Broker beide Peers vermittelt hat —
   * die eigentliche P2P-DataChannel-Öffnung folgt asynchron danach.
   */
  async attachSignaling(opts: SignalingAttachOpts): Promise<void> {
    if (this.pc === null) throw new Error('Transport not connected — call connect() first');
    const pc = this.pc;
    // Nur echte AdapterKey akzeptieren; wenn strategy gesetzt, single-shot,
    // sonst volle Fallback-Kette.
    const order: AdapterKey[] = opts.strategy !== undefined
      ? [opts.strategy]
      : STRATEGY_ORDER;
    // ICE-Kandidaten des lokalen Peers via Broker mit-teilen (Handler muss
    // GESETZT sein bevor der Adapter open feuert — sonst gehen frühe
    // Kandidaten verloren; deshalb hier vor connectWithFallback).
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
        // A initiiert Offer nach open; B wartet auf offer via onMessage.
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
        // Broker/NAT-Fehler → User-sichtbare Meldung. Symmetric-NAT scheitert
        // hier trotz STUN (kein TURN in V1) — Meldung muss das benennen.
        opts.onError?.(new Error(`NAT/Signaling failed: ${err.message}`));
      },
    });
  }

  // Legacy-Direct-Adapter für Tests, die die Fallback-Kette umgehen wollen.
  // Nutzt createSignalingAdapter direkt — kein Orchestrator.
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
    // Kanal (noch) nicht offen → puffern statt werfen. `send()` verspricht laut
    // SessionTransport-Vertrag Zustellung, nicht Sofort-Übertragung; der Flush
    // bei `onopen` löst das Versprechen ein. Bounded: bei Überlauf ältestes raus.
    if (this.outbox.length >= WebRtcTransport.MAX_OUTBOX) this.outbox.shift();
    this.outbox.push(msg);
  }

  /** Gepufferte Nachrichten in Reihenfolge über den offenen Kanal senden. */
  private flushOutbox(ch: RTCDataChannel): void {
    if (ch.readyState !== 'open' || this.outbox.length === 0) return;
    const pending = this.outbox;
    this.outbox = [];
    for (const msg of pending) ch.send(JSON.stringify(msg));
  }

  onMessage(cb: (msg: TransportMessage) => void): () => void {
    this.handlers.push(cb);
    // Receive-Replay: bereits eingetroffene Nachrichten an den neuen Listener
    // nachspielen (z.B. Store-Bridge bekommt den Join-Snapshot, der VOR ihrem
    // Attach ankam). Idempotente Consumer (applySnapshot/applyDelta) vertragen das.
    for (const msg of this.inbox) cb(msg);
    return () => {
      const i = this.handlers.indexOf(cb);
      if (i !== -1) this.handlers.splice(i, 1);
    };
  }

  /** Eingehende Nachricht puffern (bounded) + an ALLE Listener verteilen. */
  private dispatchIncoming(msg: TransportMessage): void {
    if (this.inbox.length >= WebRtcTransport.MAX_INBOX) this.inbox.shift();
    this.inbox.push(msg);
    // Kopie, falls ein Handler sich während der Iteration ab-/anmeldet.
    for (const h of [...this.handlers]) h(msg);
  }

  /**
   * Convenience: baut einen Host-Transport, dessen Authenticator direkt an
   * validateToken(db) hängt. So verdrahtet die App die per-Nachricht-Auth
   * (S02 Decision 8) mit einer Zeile beim Aufsetzen des Servers.
   */
  static host(campaignId: string, database: DatabaseLike, iceServers?: RTCIceServer[]): WebRtcTransport {
    return new WebRtcTransport({
      campaignId,
      iceServers,
      authenticate: (tok) => validateToken(database, tok),
    });
  }

  private wireChannel(ch: RTCDataChannel): void {
    // Sobald der Kanal offen ist, gepufferte Nachrichten flushen (#387). Falls er
    // beim Verdrahten schon offen ist (Race), sofort flushen.
    ch.onopen = () => this.flushOutbox(ch);
    if (ch.readyState === 'open') this.flushOutbox(ch);
    ch.onmessage = (ev: MessageEvent) => {
      // Jede eingehende Nachricht wird VOR der Verarbeitung schema-validiert
      // (AC). Ungültige Payloads werden verworfen, ohne den Handler zu rufen.
      let parsed: TransportMessage;
      try {
        parsed = validateIncomingMessage(JSON.parse(ev.data as string) as unknown);
      } catch {
        return;
      }
      // M10-#387: pre-auth Handshake-Nachrichten (join_request/reconnect_request)
      // umgehen das Token-Gate — der Absender hat noch/wieder kein gültiges Token.
      // Sie werden host-autoritativ von host-join-sync validiert (Code gegen
      // invite_codes, Token gegen session_players), nicht hier. Alle anderen
      // Nachrichten bleiben voll gegated (Decision 8, secure-by-default).
      if (PRE_AUTH_MESSAGE_TYPES.has(parsed.type)) {
        this.dispatchIncoming(parsed);
        return;
      }
      // S02 Decision 8: pro Nachricht Token-Validierung. Wenn ein Authenticator
      // gesetzt ist (Host-Seite), erst nach OK an den Handler weitergeben.
      const auth = this.options.authenticate;
      if (auth) {
        void Promise.resolve(auth(parsed.token)).then((ok) => {
          if (ok) this.dispatchIncoming(parsed);
          /* not ok → Nachricht verworfen; kein Kanal-Feedback (Client soll
             nicht wissen, ob Token existiert oder gekickt ist) */
        }).catch(() => { /* fail-closed: verwerfen */ });
        return;
      }
      this.dispatchIncoming(parsed);
    };
  }
}
