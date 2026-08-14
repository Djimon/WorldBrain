import { validateIncomingMessage } from './session-transport';
import type { ClientMessage, SessionTransport } from './session-transport';

export interface SignalingChannel {
  sendOffer(playerId: string, sdp: string): Promise<void>;
  onAnswer(handler: (playerId: string, sdp: string) => void): void;
}

export interface WebRtcTransportOptions {
  iceServers?: RTCIceServer[];
  signalingChannel: SignalingChannel;
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class WebRtcTransport implements SessionTransport {
  private pc: RTCPeerConnection;
  private channels = new Map<string, RTCDataChannel>();
  private messageHandler: ((playerId: string, message: ClientMessage) => void) | null = null;

  constructor(options: WebRtcTransportOptions) {
    const iceServers = options.iceServers ?? DEFAULT_ICE_SERVERS;
    this.pc = new RTCPeerConnection({ iceServers });

    if (typeof this.pc.createDataChannel !== 'function') {
      throw new Error('not implemented');
    }

    this.pc.oniceconnectionstatechange = () => {
      const state = (this.pc as RTCPeerConnection & { iceConnectionState: string }).iceConnectionState;
      if (state === 'failed') {
        const el = document.createElement('div');
        el.setAttribute('role', 'alert');
        el.textContent = 'WebRTC-Verbindung fehlgeschlagen';
        document.body.appendChild(el);
      }
    };

    void this.initSignaling(options.signalingChannel);
  }

  private async initSignaling(signalingChannel: SignalingChannel): Promise<void> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    await new Promise<void>((resolve) => {
      if (this.pc.iceGatheringState === 'complete') { resolve(); return; }
      this.pc.onicegatheringstatechange = () => {
        if (this.pc.iceGatheringState === 'complete') resolve();
      };
    });

    await signalingChannel.sendOffer('host', JSON.stringify(this.pc.localDescription));

    signalingChannel.onAnswer((_playerId, sdpJson) => {
      void this.pc.setRemoteDescription(JSON.parse(sdpJson) as RTCSessionDescriptionInit);
    });
  }

  async addPlayer(playerId: string): Promise<void> {
    const ch = this.pc.createDataChannel(playerId);
    this.channels.set(playerId, ch);
    ch.onmessage = (e: MessageEvent) => {
      try {
        const raw = JSON.parse(e.data as string) as unknown;
        const msg = validateIncomingMessage(raw);
        if (this.messageHandler) this.messageHandler(playerId, msg);
      } catch {
        // invalid message → discard silently
      }
    };
  }

  getPlayerCount(): number {
    return this.channels.size;
  }

  async send(playerId: string, message: ClientMessage): Promise<void> {
    this.channels.get(playerId)?.send(JSON.stringify(message));
  }

  async broadcast(message: ClientMessage): Promise<void> {
    const json = JSON.stringify(message);
    for (const ch of this.channels.values()) ch.send(json);
  }

  onMessage(handler: (playerId: string, message: ClientMessage) => void): void {
    this.messageHandler = handler;
  }

  async disconnect(playerId: string): Promise<void> {
    this.channels.get(playerId)?.close();
    this.channels.delete(playerId);
  }
}
