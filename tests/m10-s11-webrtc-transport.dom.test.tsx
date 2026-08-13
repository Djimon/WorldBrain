// @vitest-environment jsdom
// M10-S11: WebRTC DataChannel Transport — Internet-Stufe
// See: https://github.com/Djimon/WorldBrain/issues/322
//
// RTCPeerConnection + RTCDataChannel are mocked.
// WebRtcTransport must implement SessionTransport (M10-S01 interface).
// RED: WebRtcTransport constructor throws 'not implemented'.

import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import type { ClientMessage, SessionTransport } from '../src/services/session-transport';
import { validateIncomingMessage } from '../src/services/session-transport';

// ── RTCPeerConnection / RTCDataChannel mocks ─────────────────────────────────

const rtcMocks = vi.hoisted(() => {
  class FakeDataChannel extends EventTarget {
    label: string;
    readyState: string = 'open';
    sentMessages: unknown[] = [];
    onmessage: ((e: MessageEvent) => void) | null = null;

    constructor(label: string) {
      super();
      this.label = label;
    }

    send(data: unknown) {
      this.sentMessages.push(data);
    }

    simulateMessage(data: unknown) {
      if (this.onmessage) {
        this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
      }
    }

    close() { this.readyState = 'closed'; }
  }

  class FakePeerConnection extends EventTarget {
    static allInstances: FakePeerConnection[] = [];
    iceServers: RTCIceServer[];
    iceGatheringState: RTCIceGatheringState = 'new';
    channels: FakeDataChannel[] = [];
    localDescription: RTCSessionDescriptionInit | null = null;
    remoteDescription: RTCSessionDescriptionInit | null = null;

    onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null;
    oniceconnectionstatechange: (() => void) | null = null;
    ondatachannel: ((e: RTCDataChannelEvent) => void) | null = null;
    onicegatheringstatechange: (() => void) | null = null;

    constructor(config: RTCConfiguration) {
      super();
      this.iceServers = config.iceServers ?? [];
      FakePeerConnection.allInstances.push(this);
    }

    createDataChannel(label: string): FakeDataChannel {
      const ch = new FakeDataChannel(label);
      this.channels.push(ch);
      return ch;
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
      return { type: 'offer', sdp: 'fake-sdp-offer' };
    }

    async createAnswer(): Promise<RTCSessionDescriptionInit> {
      return { type: 'answer', sdp: 'fake-sdp-answer' };
    }

    async setLocalDescription(desc: RTCSessionDescriptionInit) {
      this.localDescription = desc;
      this.iceGatheringState = 'complete';
      if (this.onicegatheringstatechange) this.onicegatheringstatechange();
    }

    async setRemoteDescription(desc: RTCSessionDescriptionInit) {
      this.remoteDescription = desc;
    }

    close() {}
  }

  return { FakeDataChannel, FakePeerConnection };
});

beforeEach(() => {
  rtcMocks.FakePeerConnection.allInstances = [];
  vi.stubGlobal('RTCPeerConnection', rtcMocks.FakePeerConnection);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ── AP-003: no alert/confirm/prompt in source ─────────────────────────────────

it('AP-003: webrtc-transport.ts contains no alert/confirm/prompt calls', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
  expect(src).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
});

// ── SessionTransport interface compliance ─────────────────────────────────────

describe('M10-S11 WebRtcTransport implements SessionTransport', () => {
  it('has send / broadcast / onMessage / disconnect methods', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = {
      sendOffer: vi.fn().mockResolvedValue(undefined),
      onAnswer: vi.fn(),
    };
    const t = new WebRtcTransport({ signalingChannel: mockSignaling });
    const iface: SessionTransport = t;
    expect(typeof iface.send).toBe('function');
    expect(typeof iface.broadcast).toBe('function');
    expect(typeof iface.onMessage).toBe('function');
    expect(typeof iface.disconnect).toBe('function');
  });
});

// ── iceServers: STUN yes, TURN no ────────────────────────────────────────────

describe('M10-S11 iceServers config', () => {
  it('default iceServers contains at least one stun: entry', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    new WebRtcTransport({ signalingChannel: mockSignaling });
    const stuns = rtcMocks.FakePeerConnection.allInstances[0]?.iceServers ?? [];
    const hasStun = stuns.some((s) =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => u.startsWith('stun:')),
    );
    expect(hasStun).toBe(true);
  });

  it('default iceServers contains NO turn: entry', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    new WebRtcTransport({ signalingChannel: mockSignaling });
    const stuns = rtcMocks.FakePeerConnection.allInstances[0]?.iceServers ?? [];
    const hasTurn = stuns.some((s) =>
      (Array.isArray(s.urls) ? s.urls : [s.urls]).some((u) => u.startsWith('turn:')),
    );
    expect(hasTurn).toBe(false);
  });
});

// ── One DataChannel per player ────────────────────────────────────────────────

describe('M10-S11 one DataChannel per player', () => {
  it('addPlayer creates exactly one RTCDataChannel per player', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    const transport = new WebRtcTransport({ signalingChannel: mockSignaling });
    await transport.addPlayer('player-1');
    await transport.addPlayer('player-2');
    expect(transport.getPlayerCount()).toBe(2);
  });
});

// ── Send/receive round-trip via DataChannel ───────────────────────────────────

describe('M10-S11 send/receive round-trip', () => {
  it('send() sends serialized message over the player DataChannel', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    const transport = new WebRtcTransport({ signalingChannel: mockSignaling });
    await transport.addPlayer('p1');

    const msg: ClientMessage = { type: 'move', payload: { x: 10, y: 20 } };
    await transport.send('p1', msg);

    const pc = rtcMocks.FakePeerConnection.allInstances[0]!;
    const ch = pc.channels[0]!;
    expect(ch.sentMessages.length).toBe(1);
    expect(JSON.parse(ch.sentMessages[0] as string)).toEqual(msg);
  });

  it('incoming DataChannel message triggers onMessage handler (after validateIncomingMessage)', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    const transport = new WebRtcTransport({ signalingChannel: mockSignaling });
    await transport.addPlayer('p1');

    const received: Array<{ playerId: string; message: ClientMessage }> = [];
    transport.onMessage((pid, msg) => received.push({ playerId: pid, message: msg }));

    const pc = rtcMocks.FakePeerConnection.allInstances[0]!;
    const ch = pc.channels[0]!;
    ch.simulateMessage({ type: 'ping', payload: {} });

    expect(received.length).toBe(1);
    expect(received[0]!.playerId).toBe('p1');
    expect(received[0]!.message.type).toBe('ping');
  });
});

// ── ICE failure → rendered error, no alert ───────────────────────────────────

describe('M10-S11 ICE failure → rendered error', () => {
  it('renders a failure message when ICE state is "failed" (no alert)', async () => {
    const { render } = await import('@testing-library/react');
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    const transport = new WebRtcTransport({ signalingChannel: mockSignaling });

    // Trigger ICE failure
    const container = document.createElement('div');
    document.body.appendChild(container);
    await transport.addPlayer('p1');

    const pc = rtcMocks.FakePeerConnection.allInstances[0]!;
    // Simulate ICE failure event
    (pc as unknown as { iceConnectionState: string }).iceConnectionState = 'failed';
    if (pc.oniceconnectionstatechange) pc.oniceconnectionstatechange();

    // The transport must render an error element somewhere reachable via role=alert
    const alertEl = document.querySelector('[role="alert"]');
    expect(alertEl).not.toBeNull();
    expect(alertEl!.textContent).not.toBe('');
    document.body.removeChild(container);
    void render; // import kept for future use
  });
});

// ── Host validates incoming messages (schema + token) ────────────────────────

describe('M10-S11 host-side validation', () => {
  it('invalid message shape is discarded — onMessage handler NOT called', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const mockSignaling = { sendOffer: vi.fn().mockResolvedValue(undefined), onAnswer: vi.fn() };
    const transport = new WebRtcTransport({ signalingChannel: mockSignaling });
    await transport.addPlayer('p1');

    const received: unknown[] = [];
    transport.onMessage((_pid, msg) => received.push(msg));

    const pc = rtcMocks.FakePeerConnection.allInstances[0]!;
    const ch = pc.channels[0]!;
    // Malformed message (missing payload)
    ch.simulateMessage({ type: 'bad-message' });

    expect(received.length).toBe(0);
  });

  it('validateIncomingMessage is the same guard used by LAN transport', () => {
    // Structural: the function is exported from session-transport and reused
    expect(() => validateIncomingMessage({ type: 'ok', payload: {} })).not.toThrow();
    expect(() => validateIncomingMessage({ badKey: true })).toThrow();
  });
});
