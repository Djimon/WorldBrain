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

import { validateIncomingMessage } from './session-transport';
import type { SessionTransport, TransportMessage } from './session-transport';
import type { DatabaseLike } from './entity-service';
import { validateToken } from './session-identity-service';
import { createSignalingAdapter } from './signaling';
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
}

export class WebRtcTransport implements SessionTransport {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private handler: ((msg: TransportMessage) => void) | null = null;
  private signalingHandle: AdapterHandle | null = null;

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
    this.handler = null;
    this.signalingHandle = null;
  }

  /**
   * S11: Signaling-Adapter (#368) an den Transport hängen. Der Adapter
   * tauscht SDP-Offer/Answer + ICE-Kandidaten über den Broker (Nostr/MQTT/
   * BitTorrent/PeerJS) aus. Danach läuft die P2P-Verbindung direkt.
   *
   * Der Broker sieht nur SDP/ICE — keine Spieldaten (E2E via WebRTC).
   * Bei strenger Symmetric-NAT scheitert die ICE-Handshake trotz STUN und
   * feuert `onError` (kein TURN in V1).
   */
  async attachSignaling(opts: SignalingAttachOpts): Promise<void> {
    if (this.pc === null) throw new Error('Transport not connected — call connect() first');
    const pc = this.pc;
    const strategy: AdapterKey = opts.strategy ?? 'nostr';
    this.signalingHandle = await createSignalingAdapter(strategy, {
      appId: opts.appId,
      roomId: opts.roomId,
      peerLabel: opts.peerLabel,
      onOpen: () => opts.onDiagnostic?.('[signaling] peer joined broker'),
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
    // ICE-Kandidaten des lokalen Peers via Broker mit-teilen.
    pc.onicecandidate = (ev) => {
      if (ev.candidate !== null) {
        this.signalingHandle?.send({ kind: 'ice', candidate: ev.candidate.toJSON() });
      }
    };
    // Offer initiiert die A-Seite; B wartet auf Offer.
    if (opts.peerLabel === 'A') {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signalingHandle.send({ kind: 'offer', sdp: offer.sdp, type: offer.type });
    }
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
    if (this.channel === null || this.channel.readyState !== 'open') {
      throw new Error('Transport not connected');
    }
    this.channel.send(JSON.stringify(msg));
  }

  onMessage(cb: (msg: TransportMessage) => void): void {
    this.handler = cb;
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
    ch.onmessage = (ev: MessageEvent) => {
      // Jede eingehende Nachricht wird VOR der Verarbeitung schema-validiert
      // (AC). Ungültige Payloads werden verworfen, ohne den Handler zu rufen.
      let parsed: TransportMessage;
      try {
        parsed = validateIncomingMessage(JSON.parse(ev.data as string) as unknown);
      } catch {
        return;
      }
      // S02 Decision 8: pro Nachricht Token-Validierung. Wenn ein Authenticator
      // gesetzt ist (Host-Seite), erst nach OK an den Handler weitergeben.
      const auth = this.options.authenticate;
      if (auth) {
        void Promise.resolve(auth(parsed.token)).then((ok) => {
          if (ok) this.handler?.(parsed);
          /* not ok → Nachricht verworfen; kein Kanal-Feedback (Client soll
             nicht wissen, ob Token existiert oder gekickt ist) */
        }).catch(() => { /* fail-closed: verwerfen */ });
        return;
      }
      this.handler?.(parsed);
    };
  }
}
