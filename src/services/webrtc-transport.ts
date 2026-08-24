// M10-S01 (#350): WebRTC-DataChannel-Implementierung des SessionTransport.
// Host-Peer wird an eine gehostete Campaign gekoppelt (D23 — Roster/Invite
// hängen an der Campaign, nicht am Termin). Kein HTTP/WS-Server.
//
// Signaling (Offer/Answer-Austausch für Remote-Verbindungen) ist bewusst
// ausgeklammert (`needs-design`, S11/S12) — der Link soll die Rendezvous-Info
// tragen, konkrete Umsetzung offen.

import { validateIncomingMessage } from './session-transport';
import type { SessionTransport, TransportMessage } from './session-transport';
import type { DatabaseLike } from './entity-service';
import { validateToken } from './session-identity-service';

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

export class WebRtcTransport implements SessionTransport {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private handler: ((msg: TransportMessage) => void) | null = null;

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
    this.channel = null;
    this.pc = null;
    this.handler = null;
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
