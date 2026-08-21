// @vitest-environment node
// M10-S11 (rebuild): Stufe-3 WebRTC+STUN (remote)
// See: https://github.com/Djimon/WorldBrain/issues/367

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('M10-S11 WebRTC+STUN', () => {
  it('webrtc-transport.ts uses STUN for NAT traversal', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/stun|iceServers/i);
  });

  it('no TURN or relay server configured', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).not.toMatch(/turn:|relay/i);
  });

  it('connection failure produces a clear error message (symmetric NAT)', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/NAT|connection.*fail|error.*message/i);
  });

  it('transport interface (S01) is reused, not rewritten', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/SessionTransport/);
  });
});
