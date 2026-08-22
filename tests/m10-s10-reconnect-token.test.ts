// @vitest-environment node
// M10-S10 (rebuild): Reconnect & Token-Persistenz
// See: https://github.com/Djimon/WorldBrain/issues/359

import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// 1. Token persistence service
// ---------------------------------------------------------------------------

describe('M10-S10 Token persistence', () => {
  async function getReconnectService() {
    return import('../src/services/reconnect-service');
  }

  it('persistToken stores token data', async () => {
    const svc = await getReconnectService();
    await svc.persistToken({
      hostLabel: 'DM-Server',
      code: 'ABC123',
      token: 'tok-xyz',
      displayName: 'Alice',
      campaignName: 'Frostfall',
    });
    const stored = await svc.getStoredToken('tok-xyz');
    expect(stored).toBeTruthy();
    expect(stored?.displayName).toBe('Alice');
  });

  it('reconnect with valid active token succeeds', async () => {
    const svc = await getReconnectService();
    const result = await svc.reconnect({ token: 'tok-active' });
    expect(result.success).toBe(true);
  });

  it('reconnect with kicked token is rejected', async () => {
    const svc = await getReconnectService();
    const result = await svc.reconnect({ token: 'tok-kicked' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Ping-based online detection (no heartbeat)
// ---------------------------------------------------------------------------

describe('M10-S10 Online detection', () => {
  async function getReconnectService() {
    return import('../src/services/reconnect-service');
  }

  it('ping checks host availability without heartbeat', async () => {
    const svc = await getReconnectService();
    expect(svc).toHaveProperty('ping');
  });

  it('no heartbeat mechanism exported', async () => {
    const svc = await getReconnectService();
    expect(svc).not.toHaveProperty('startHeartbeat');
    expect(svc).not.toHaveProperty('heartbeat');
  });
});
