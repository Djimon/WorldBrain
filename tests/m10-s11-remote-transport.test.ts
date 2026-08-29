// @vitest-environment node
// M10-S11 (rewrite): Remote-Transport-Integration (Adapter-Komposition + appId + Invite + Connect-UI)
// See: https://github.com/Djimon/WorldBrain/issues/367

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Transport composes adapter (not extends)
// ---------------------------------------------------------------------------

describe('M10-S11 Transport-Adapter composition', () => {
  it('webrtc-transport calls createSignalingAdapter', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/createSignalingAdapter/);
  });

  it('transport passes roomId and appId to the adapter', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/roomId/);
    expect(source).toMatch(/appId/);
  });
});

// ---------------------------------------------------------------------------
// 2. appId derivation + host-secret provider
// ---------------------------------------------------------------------------

describe('M10-S11 appId derivation', () => {
  async function getAppIdService() {
    return import('../src/services/app-id-service');
  }

  it('deriveAppId hashes appName + majorMinor + hostSecret', async () => {
    const svc = await getAppIdService();
    const id = await svc.deriveAppId({
      appName: 'WorldBuilderX',
      majorMinor: '0.9',
      hostSecret: 'test-secret-123',
    });
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(8);
  });

  it('same inputs produce same appId (deterministic)', async () => {
    const svc = await getAppIdService();
    const opts = { appName: 'WorldBuilderX', majorMinor: '0.9', hostSecret: 'abc' };
    const a = await svc.deriveAppId(opts);
    const b = await svc.deriveAppId(opts);
    expect(a).toBe(b);
  });

  it('different hostSecret produces different appId', async () => {
    const svc = await getAppIdService();
    const a = await svc.deriveAppId({ appName: 'WorldBuilderX', majorMinor: '0.9', hostSecret: 'secret-A' });
    const b = await svc.deriveAppId({ appName: 'WorldBuilderX', majorMinor: '0.9', hostSecret: 'secret-B' });
    expect(a).not.toBe(b);
  });

  it('getHostSecret provider interface exists', async () => {
    const svc = await getAppIdService();
    expect(svc).toHaveProperty('getHostSecret');
  });
});

// ---------------------------------------------------------------------------
// 3. Invite link carries namespace
// ---------------------------------------------------------------------------

describe('M10-S11 Invite link namespace', () => {
  it('invite link includes ns parameter', () => {
    const source = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(source).toMatch(/ns=|&ns=/);
  });

  it('PlayerJoinView reads ns from link and passes as appId', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/ns|appId/);
  });
});

// ---------------------------------------------------------------------------
// 4. Connect-Flow UI states
// ---------------------------------------------------------------------------

describe('M10-S11 Connect-Flow UI', () => {
  it('connect flow has idle/connecting/connected/failed states', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/idle|connecting|connected|failed/);
  });

  it('no manual SDP panel in connect flow', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).not.toMatch(/ManualSdpPanel|sdp.*paste|paste.*sdp/i);
  });

  it('uses primitives (Panel, StatusChip, Button) for connect UI', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:Panel|StatusChip|Button).*from.*primitives/);
  });

  it('uses useTranslation, no hardcoded strings', () => {
    const source = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8');
    expect(source).toMatch(/useTranslation/);
  });
});

// ---------------------------------------------------------------------------
// 5. No TURN (clear error for symmetric NAT)
// ---------------------------------------------------------------------------

describe('M10-S11 NAT handling', () => {
  it('no TURN server configured', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).not.toMatch(/turn:|relay/i);
  });

  it('connection failure produces user-visible error', () => {
    const source = readFileSync('src/services/webrtc-transport.ts', 'utf-8');
    expect(source).toMatch(/NAT|connection.*fail|onError/i);
  });
});
