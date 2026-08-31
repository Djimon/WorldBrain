// @vitest-environment node
// M10-S01 (rebuild): WebRTC-Transport & Host-Lebenszyklus
// See: https://github.com/Djimon/WorldBrain/issues/350

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Transport interface exists
// ---------------------------------------------------------------------------

describe('M10-S01 Transport interface contract', () => {
  it('session-transport.ts exports a SessionTransport type/interface', () => {
    const source = readFileSync('src/services/session-transport.ts', 'utf-8');
    expect(source).toMatch(/export\s+(type|interface)\s+SessionTransport/);
  });

  it('SessionTransport declares send(msg)', () => {
    const source = readFileSync('src/services/session-transport.ts', 'utf-8');
    expect(source).toMatch(/send\s*\(/);
  });

  it('SessionTransport declares onMessage(cb)', () => {
    const source = readFileSync('src/services/session-transport.ts', 'utf-8');
    expect(source).toMatch(/onMessage\s*\(/);
  });

  it('SessionTransport declares connect', () => {
    const source = readFileSync('src/services/session-transport.ts', 'utf-8');
    expect(source).toMatch(/connect\s*[(:]/);
  });

  it('SessionTransport declares close', () => {
    const source = readFileSync('src/services/session-transport.ts', 'utf-8');
    expect(source).toMatch(/close\s*[(:]/);
  });
});

// ---------------------------------------------------------------------------
// 2. WebRTC implementation exists and implements the interface
// ---------------------------------------------------------------------------

describe('M10-S01 WebRTC implementation', () => {
  it('webrtc-transport.ts exists and exports a class/function', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/export\s+(class|function|const)\s+\w/);
  });

  it('webrtc-transport uses RTCPeerConnection or DataChannel', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/RTCPeerConnection|RTCDataChannel|createDataChannel|ondatachannel/);
  });

  it('webrtc-transport imports or references SessionTransport', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/SessionTransport/);
  });
});

// ---------------------------------------------------------------------------
// 3. Host lifecycle: tied to campaign
// ---------------------------------------------------------------------------

describe('M10-S01 Host lifecycle', () => {
  it('host peer creation requires a campaign reference', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/campaign/i);
  });
});

// ---------------------------------------------------------------------------
// 4. Schema validation: incoming messages validated
// ---------------------------------------------------------------------------

describe('M10-S01 Incoming message validation', () => {
  it('webrtc-transport validates incoming messages before processing', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/validat|schema|parse|safeParse|MessageSchema/i);
  });
});

// ---------------------------------------------------------------------------
// 5. #387: send() buffers until the DataChannel is open (onConnected fires at
//    broker rendezvous, BEFORE the channel opens — a proactive send like
//    join_request must NOT throw, it must be delivered once the channel opens).
// ---------------------------------------------------------------------------

describe('M10-#387 send buffers until channel open', () => {
  it('send() no longer throws "not connected" — it buffers into an outbox', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    // Regression guard: der frühere `throw new Error('Transport not connected')`
    // in send() brach jeden pre-open Handshake-Send. Er darf nicht zurückkehren.
    expect(source).not.toMatch(/async send\([^)]*\)[^{]*\{\s*if[^}]*throw new Error\('Transport not connected'\)/s);
    expect(source).toMatch(/outbox/);
  });

  it('a buffered outbox is flushed on channel onopen', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/onopen\s*=\s*\(\)\s*=>\s*this\.flushOutbox/);
  });
});
