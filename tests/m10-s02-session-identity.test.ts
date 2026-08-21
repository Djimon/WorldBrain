// @vitest-environment node
// M10-S02 (rebuild): Campaign-Identität, Einladungscodes & Token-Auth (Auto-Join)
// See: https://github.com/Djimon/WorldBrain/issues/351

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
// 1. Invite code generation
// ---------------------------------------------------------------------------

describe('M10-S02 Invite code generation', () => {
  async function getIdentityService() {
    return import('../src/services/session-identity-service');
  }

  it('generateInviteCode returns a non-empty string', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it('invite code is cryptographically random (two codes differ)', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const a = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      const b = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      expect(a).not.toBe(b);
    } finally {
      db.close();
    }
  });

  it('regenerating code invalidates old code for new joins', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const oldCode = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      await expect(svc.joinWithCode(asyncDb, { code: oldCode, displayName: 'Late' })).rejects.toThrow();
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. joinWithCode → immediate active member (D24: Auto-Join, no pending)
// ---------------------------------------------------------------------------

describe('M10-S02 joinWithCode auto-join', () => {
  async function getIdentityService() {
    return import('../src/services/session-identity-service');
  }

  it('joinWithCode with valid code returns a token immediately', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      const result = await svc.joinWithCode(asyncDb, { code, displayName: 'Alice' });
      expect(result).toHaveProperty('token');
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(0);
    } finally {
      db.close();
    }
  });

  it('joinWithCode inserts session_players row with status=active', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      await svc.joinWithCode(asyncDb, { code, displayName: 'Bob' });
      const rows = db
        .prepare('SELECT status FROM session_players')
        .all() as { status: string }[];
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('active');
    } finally {
      db.close();
    }
  });

  it('no pending/approved/rejected status exists in schema', () => {
    const schema = runtimeSchemaSql;
    expect(schema).not.toMatch(/pending/i);
    expect(schema).not.toMatch(/approved/i);
    expect(schema).not.toMatch(/rejected/i);
  });

  it('invalid code throws error', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      await expect(
        svc.joinWithCode(asyncDb, { code: 'INVALID', displayName: 'Eve' }),
      ).rejects.toThrow();
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Token auth: every message validated, kicked token rejected
// ---------------------------------------------------------------------------

describe('M10-S02 Token auth', () => {
  async function getIdentityService() {
    return import('../src/services/session-identity-service');
  }

  it('validateToken accepts valid active token', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const code = await svc.generateInviteCode(asyncDb, { campaignId: 'camp-1' });
      const { token } = await svc.joinWithCode(asyncDb, { code, displayName: 'Carol' });
      const valid = await svc.validateToken(asyncDb, token);
      expect(valid).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it('validateToken rejects unknown token', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getIdentityService();
      const valid = await svc.validateToken(asyncDb, 'nonexistent-token');
      expect(valid).toBeFalsy();
    } finally {
      db.close();
    }
  });

  it('tokens are never logged or exposed to other players', () => {
    const source = readFileSync('src/services/session-identity-service.ts', 'utf-8');
    expect(source).not.toMatch(/console\.log\(.*token/i);
  });
});
