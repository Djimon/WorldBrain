import type { ClientMessage, SessionTransport } from './session-transport';

export interface SignalingChannel {
  sendOffer(playerId: string, sdp: string): Promise<void>;
  onAnswer(handler: (playerId: string, sdp: string) => void): void;
}

export interface WebRtcTransportOptions {
  iceServers?: RTCIceServer[];
  signalingChannel: SignalingChannel;
}

export class WebRtcTransport implements SessionTransport {
  constructor(_options: WebRtcTransportOptions) {
    throw new Error('not implemented');
  }

  send(_playerId: string, _message: ClientMessage): Promise<void> {
    throw new Error('not implemented');
  }

  broadcast(_message: ClientMessage): Promise<void> {
    throw new Error('not implemented');
  }

  onMessage(_handler: (playerId: string, message: ClientMessage) => void): void {
    throw new Error('not implemented');
  }

  disconnect(_playerId: string): Promise<void> {
    throw new Error('not implemented');
  }

  addPlayer(_playerId: string): Promise<void> {
    throw new Error('not implemented');
  }

  getPlayerCount(): number {
    throw new Error('not implemented');
  }

  getIceServers(): RTCIceServer[] {
    throw new Error('not implemented');
  }
}
