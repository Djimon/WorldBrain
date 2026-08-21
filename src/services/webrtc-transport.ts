// M10-S01 (#350): WebRTC-DataChannel-Implementierung des SessionTransport.
// Host-Peer wird an eine gehostete Campaign gekoppelt (D23 — Roster/Invite
// hängen an der Campaign, nicht am Termin). Kein HTTP/WS-Server.
//
// Signaling (Offer/Answer-Austausch für Remote-Verbindungen) ist bewusst
// ausgeklammert (`needs-design`, S11/S12) — der Link soll die Rendezvous-Info
// tragen, konkrete Umsetzung offen.

import { validateIncomingMessage } from './session-transport';
import type { SessionTransport, TransportMessage } from './session-transport';

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
      this.handler?.(parsed);
    };
  }
}
