// M10-S01: Lokaler Session-Server & Transport-Abstraktion
// See: https://github.com/Djimon/WorldBrain/issues/195
//
// RED: startSessionServer/stopSessionServer/createSessionTransport/
// validateIncomingMessage stubs throw. Tests fail until implementer wires
// Tauri commands + transport factory.

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockInvoke = invoke as ReturnType<typeof vi.fn>;

async function getSvc() {
  return import('../src/services/session-transport');
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Server lifecycle ──────────────────────────────────────────────────────────

describe('M10-S01 session server lifecycle', () => {
  it('startSessionServer invokes the "start_session_server" Tauri command', async () => {
    mockInvoke.mockResolvedValue({ url: 'http://192.168.1.5:9000', port: 9000 });
    const svc = await getSvc();
    await svc.startSessionServer(9000);
    expect(mockInvoke).toHaveBeenCalledWith('start_session_server', expect.objectContaining({ port: 9000 }));
  });

  it('startSessionServer returns url + port for DM display', async () => {
    mockInvoke.mockResolvedValue({ url: 'http://192.168.1.5:9000', port: 9000 });
    const svc = await getSvc();
    const info = await svc.startSessionServer(9000);
    expect(info.url).toMatch(/^http:\/\//);
    expect(typeof info.port).toBe('number');
  });

  it('stopSessionServer invokes the "stop_session_server" Tauri command', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const svc = await getSvc();
    await svc.stopSessionServer();
    expect(mockInvoke).toHaveBeenCalledWith('stop_session_server');
  });

  it('default port is used when no port argument given', async () => {
    mockInvoke.mockResolvedValue({ url: 'http://192.168.1.5:9010', port: 9010 });
    const svc = await getSvc();
    await svc.startSessionServer();
    expect(mockInvoke).toHaveBeenCalledWith(
      'start_session_server',
      expect.any(Object),
    );
  });
});

// ── Transport interface ───────────────────────────────────────────────────────

describe('M10-S01 SessionTransport interface', () => {
  it('createSessionTransport returns an object with send, broadcast, onMessage, disconnect', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const svc = await getSvc();
    const transport = svc.createSessionTransport();
    expect(typeof transport.send).toBe('function');
    expect(typeof transport.broadcast).toBe('function');
    expect(typeof transport.onMessage).toBe('function');
    expect(typeof transport.disconnect).toBe('function');
  });

  it('transport.send invokes a Tauri command with playerId + message', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const svc = await getSvc();
    const transport = svc.createSessionTransport();
    await transport.send('player-1', { type: 'reveal', payload: { entityId: 'e1' } });
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('send'),
      expect.objectContaining({ playerId: 'player-1' }),
    );
  });

  it('transport.broadcast sends to all connected players', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const svc = await getSvc();
    const transport = svc.createSessionTransport();
    await transport.broadcast({ type: 'spotlight', payload: { entityId: 'e2' } });
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.stringContaining('broadcast'),
      expect.any(Object),
    );
  });

  it('transport.disconnect invokes a Tauri command with the playerId', async () => {
    mockInvoke.mockResolvedValue(undefined);
    const svc = await getSvc();
    const transport = svc.createSessionTransport();
    await transport.disconnect('player-99');
    expect(mockInvoke).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ playerId: 'player-99' }),
    );
  });
});

// ── Schema validation (D20, Decision 8 — server-side enforcement) ─────────────

describe('M10-S01 validateIncomingMessage — server-side schema guard', () => {
  it('accepts a well-formed ClientMessage { type, payload }', async () => {
    const svc = await getSvc();
    const msg = svc.validateIncomingMessage({ type: 'ping', payload: {} });
    expect(msg.type).toBe('ping');
  });

  it('throws on missing type field', async () => {
    const svc = await getSvc();
    expect(() => svc.validateIncomingMessage({ payload: {} })).toThrow();
  });

  it('throws on missing payload field', async () => {
    const svc = await getSvc();
    expect(() => svc.validateIncomingMessage({ type: 'ping' })).toThrow();
  });

  it('throws on non-string type', async () => {
    const svc = await getSvc();
    expect(() => svc.validateIncomingMessage({ type: 42, payload: {} })).toThrow();
  });

  it('throws on null / non-object input', async () => {
    const svc = await getSvc();
    expect(() => svc.validateIncomingMessage(null)).toThrow();
    expect(() => svc.validateIncomingMessage('raw string')).toThrow();
  });

  it('throws on unknown top-level fields (strict schema)', async () => {
    const svc = await getSvc();
    expect(() =>
      svc.validateIncomingMessage({ type: 'ping', payload: {}, admin: true }),
    ).toThrow();
  });
});
