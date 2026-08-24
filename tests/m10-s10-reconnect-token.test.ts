// @vitest-environment node
// M10-S10 (rebuild): Reconnect & Token-Persistenz
// See: https://github.com/Djimon/WorldBrain/issues/359

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf8',
);

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

// ---------------------------------------------------------------------------
// 1. Token persistence service
// ---------------------------------------------------------------------------

describe('M10-S10 Token persistence', () => {
  async function getReconnectService() {
    return import('../src/services/reconnect-service');
  }
  async function getIdentityService() {
    return import('../src/services/session-identity-service');
  }
  async function getMembershipService() {
    return import('../src/services/player-membership-service');
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
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getReconnectService();
      const identity = await getIdentityService();
      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      const { token } = await identity.joinWithCode(asyncDb, { code, displayName: 'Alice' });
      const result = await svc.reconnect({ token, database: asyncDb });
      expect(result.success).toBe(true);
    } finally {
      db.close();
    }
  });

  it('reconnect with kicked token is rejected', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getReconnectService();
      const identity = await getIdentityService();
      const membership = await getMembershipService();
      const code = await identity.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      const { token, playerId } = await identity.joinWithCode(asyncDb, { code, displayName: 'Bob' });
      await membership.kick(asyncDb, { campaignId: 'camp-1', playerId });
      const result = await svc.reconnect({ token, database: asyncDb });
      expect(result.success).toBe(false);
      expect(result.reason).toBe('kicked');
    } finally {
      db.close();
    }
  });

  it('reconnect without database reports no_host (offline, D10)', async () => {
    const svc = await getReconnectService();
    const result = await svc.reconnect({ token: 'any' });
    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_host');
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

  it('ping without database returns false (offline)', async () => {
    const svc = await getReconnectService();
    const ok = await svc.ping();
    expect(ok).toBe(false);
  });
});
