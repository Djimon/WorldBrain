// @vitest-environment jsdom
// M10-S12: Serverloses Signaling — manueller Code-Austausch (kein Hosted-Server)
// See: https://github.com/Djimon/WorldBrain/issues/323
//
// RTCPeerConnection gemockt; Non-Trickle-ICE geprüft (encode erst nach iceGatheringState=complete).
// RED: SignalingPanel throws 'not implemented'.

import React from 'react';
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

// ── RTCPeerConnection mock ────────────────────────────────────────────────────

const rtcMocks = vi.hoisted(() => {
  class FakePeerConnection extends EventTarget {
    static allInstances: FakePeerConnection[] = [];
    iceGatheringState: RTCIceGatheringState = 'new';
    localDescription: RTCSessionDescriptionInit | null = null;
    remoteDescription: RTCSessionDescriptionInit | null = null;
    onicegatheringstatechange: (() => void) | null = null;

    constructor(_config?: RTCConfiguration) {
      super();
      FakePeerConnection.allInstances.push(this);
    }

    async createOffer(): Promise<RTCSessionDescriptionInit> {
      return { type: 'offer', sdp: 'fake-sdp-offer' };
    }

    async createAnswer(): Promise<RTCSessionDescriptionInit> {
      return { type: 'answer', sdp: 'fake-sdp-answer' };
    }

    async setLocalDescription(desc: RTCSessionDescriptionInit) {
      this.localDescription = desc;
      // Simulate non-trickle ICE: gathering completes immediately
      this.iceGatheringState = 'complete';
      if (this.onicegatheringstatechange) this.onicegatheringstatechange();
    }

    async setRemoteDescription(desc: RTCSessionDescriptionInit) {
      this.remoteDescription = desc;
    }

    close() {}
  }

  return { FakePeerConnection };
});

beforeEach(() => {
  rtcMocks.FakePeerConnection.allInstances = [];
  vi.stubGlobal('RTCPeerConnection', rtcMocks.FakePeerConnection);
  vi.stubGlobal('btoa', (s: string) => Buffer.from(s).toString('base64'));
  vi.stubGlobal('atob', (s: string) => Buffer.from(s, 'base64').toString('utf-8'));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

// ── AP-003 ────────────────────────────────────────────────────────────────────

it('AP-003: SignalingPanel.tsx contains no alert/confirm/prompt calls', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('src/ui/SignalingPanel.tsx', 'utf-8');
  expect(src).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
});

// ── Non-Trickle ICE: encode after iceGatheringState=complete ─────────────────

describe('M10-S12 Non-Trickle ICE', () => {
  it('host offer code is only produced AFTER iceGatheringState === "complete"', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    const offerReadySpy = vi.fn();
    render(<SignalingPanel role="host" onOfferReady={offerReadySpy} />);

    // Offer code must not appear before ICE gathering is complete
    const pc = rtcMocks.FakePeerConnection.allInstances[0];
    if (pc) {
      expect(pc.iceGatheringState).not.toBe('complete');
    }

    await waitFor(() => {
      // After component mounts and ICE completes, offer should be ready
      expect(offerReadySpy).toHaveBeenCalledOnce();
    });

    const [[code]] = offerReadySpy.mock.calls as [[string]];
    // The code must be non-empty (base64-encoded SDP)
    expect(code.length).toBeGreaterThan(0);
  });
});

// ── Host UI: Code-Anzeige (kopierbar) ────────────────────────────────────────

describe('M10-S12 Host UI', () => {
  it('renders a copyable offer code display area', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="host" />);

    await waitFor(() => {
      const codeDisplay = screen.getByTestId('offer-code');
      expect(codeDisplay.textContent?.length).toBeGreaterThan(0);
    });
  });

  it('renders a step-by-step instruction text', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="host" />);

    // Must show some guidance text (Schritt 1 or equivalent)
    const panel = document.body;
    await waitFor(() => {
      expect(panel.textContent).toMatch(/schritt|step|1\.|kopier|senden/i);
    });
  });

  it('renders an answer-code input field for the host to paste player answer', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="host" />);

    await waitFor(() => {
      expect(screen.getByTestId('answer-code-input')).toBeInTheDocument();
    });
  });

  it('host submitting valid answer code triggers onConnectionEstablished', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    const onConnected = vi.fn();
    render(<SignalingPanel role="host" onConnectionEstablished={onConnected} />);

    await waitFor(() => screen.getByTestId('answer-code-input'));

    const validAnswerSdp = JSON.stringify({ type: 'answer', sdp: 'fake-sdp-answer' });
    const encoded = Buffer.from(validAnswerSdp).toString('base64');

    const input = screen.getByTestId('answer-code-input');
    fireEvent.change(input, { target: { value: encoded } });

    const submitBtn = screen.getByTestId('submit-answer-code');
    fireEvent.click(submitBtn);

    await waitFor(() => expect(onConnected).toHaveBeenCalledOnce());
  });
});

// ── Player UI ─────────────────────────────────────────────────────────────────

describe('M10-S12 Player UI', () => {
  it('renders an offer-code input field (player pastes host offer)', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="player" />);

    expect(screen.getByTestId('offer-code-input')).toBeInTheDocument();
  });

  it('renders an answer-code display area after player processes offer', async () => {
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    const { FakePeerConnection } = rtcMocks;
    render(<SignalingPanel role="player" />);

    const offerSdp = JSON.stringify({ type: 'offer', sdp: 'fake-sdp-offer' });
    const encoded = Buffer.from(offerSdp).toString('base64');

    const input = screen.getByTestId('offer-code-input');
    fireEvent.change(input, { target: { value: encoded } });

    const processBtn = screen.getByTestId('process-offer-code');
    fireEvent.click(processBtn);

    await waitFor(() => {
      const answerDisplay = screen.getByTestId('answer-code');
      expect(answerDisplay.textContent?.length).toBeGreaterThan(0);
    });
    expect(FakePeerConnection.allInstances.length).toBeGreaterThan(0);
  });
});

// ── Invalid code → rendered error ────────────────────────────────────────────

describe('M10-S12 invalid code → error UI', () => {
  it('host: invalid answer code shows rendered error, no alert', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);

    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="host" />);

    await waitFor(() => screen.getByTestId('answer-code-input'));

    const input = screen.getByTestId('answer-code-input');
    fireEvent.change(input, { target: { value: 'this-is-not-valid-base64!!!' } });

    const submitBtn = screen.getByTestId('submit-answer-code');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('player: invalid offer code shows rendered error, no alert', async () => {
    const alertSpy = vi.fn();
    vi.stubGlobal('alert', alertSpy);

    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel role="player" />);

    const input = screen.getByTestId('offer-code-input');
    fireEvent.change(input, { target: { value: '###invalid###' } });

    const processBtn = screen.getByTestId('process-offer-code');
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });
});

// ── Signaling Interface — swap impl without changing S11 ─────────────────────

describe('M10-S12 SignalingChannel interface', () => {
  it('WebRtcTransport accepts any SignalingChannel implementation (interface test)', async () => {
    const { WebRtcTransport } = await import('../src/services/webrtc-transport');
    const customSignaling = {
      sendOffer: vi.fn().mockResolvedValue(undefined),
      onAnswer: vi.fn(),
    };
    // Should not throw from constructor signature perspective (even though impl throws)
    expect(() => new WebRtcTransport({ signalingChannel: customSignaling })).toThrow('not implemented');
  });
});

// ── Roundtrip: Host → Player → Host ──────────────────────────────────────────

describe('M10-S12 full roundtrip: Offer → Answer → established', () => {
  it('host offer → player processes → answer fed back to host → connection established', async () => {
    // Host side
    const { SignalingPanel } = await import('../src/ui/SignalingPanel');
    let capturedOfferCode = '';
    const { unmount: unmountHost } = render(
      <SignalingPanel
        role="host"
        onOfferReady={(code) => { capturedOfferCode = code; }}
      />,
    );

    await waitFor(() => expect(capturedOfferCode.length).toBeGreaterThan(0));
    unmountHost();

    // Player side
    vi.resetModules();
    const { SignalingPanel: SignalingPanel2 } = await import('../src/ui/SignalingPanel');
    render(<SignalingPanel2 role="player" />);

    const offerInput = screen.getByTestId('offer-code-input');
    fireEvent.change(offerInput, { target: { value: capturedOfferCode } });
    fireEvent.click(screen.getByTestId('process-offer-code'));

    let capturedAnswerCode = '';
    await waitFor(() => {
      const el = screen.getByTestId('answer-code');
      capturedAnswerCode = el.textContent ?? '';
      expect(capturedAnswerCode.length).toBeGreaterThan(0);
    });

    // Answer is base64-encoded SDP — must decode without error
    const decoded = Buffer.from(capturedAnswerCode, 'base64').toString('utf-8');
    const sdp = JSON.parse(decoded) as { type: string; sdp: string };
    expect(sdp.type).toBe('answer');
    expect(typeof sdp.sdp).toBe('string');
  });
});
