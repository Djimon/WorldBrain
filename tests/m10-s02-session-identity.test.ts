// @vitest-environment node
// M10-S02: Session-Identität, Einladungscodes & Token-Auth
// See: https://github.com/Djimon/WorldBrain/issues/196
//
// RED: generateInviteCode/joinWithCode/validateToken/escapeHtml stubs throw.
// Tests fail until implementer adds crypto invite codes + token auth.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf-8',
);

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  // seed a session for tests
  db.prepare(
    `INSERT INTO sessions (id, title, created_at) VALUES ('s1', 'Test-Runde', datetime('now'))`,
  ).run();
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getSvc() {
  return import('../src/services/session-identity-service');
}

// ── Schema: invite code + token tables ───────────────────────────────────────

describe('M10-S02 schema: invite_codes table', () => {
  it('runtime schema creates an invite_codes table', () => {
    const { db } = createDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='invite_codes'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('invite_codes has code, session_id, created_at, is_active', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(invite_codes)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('code');
    expect(cols).toContain('session_id');
    expect(cols).toContain('created_at');
    expect(cols).toContain('is_active');
  });
});

describe('M10-S02 schema: player_tokens table', () => {
  it('runtime schema creates a player_tokens table', () => {
    const { db } = createDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='player_tokens'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('player_tokens has token, player_id, session_id, created_at', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(player_tokens)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('token');
    expect(cols).toContain('player_id');
    expect(cols).toContain('session_id');
    expect(cols).toContain('created_at');
  });
});

// ── Invite code generation ────────────────────────────────────────────────────

describe('M10-S02 generateInviteCode', () => {
  it('returns a SessionInvite with code, sessionId, created_at', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    expect(typeof invite.code).toBe('string');
    expect(invite.sessionId).toBe('s1');
    expect(invite.created_at).toBeTruthy();
  });

  it('code is at least 8 characters (not guessable)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    expect(invite.code.length).toBeGreaterThanOrEqual(8);
  });

  it('two consecutive calls produce different codes (crypto-random)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const a = await svc.generateInviteCode(asyncDb, 's1');
    const b = await svc.generateInviteCode(asyncDb, 's1');
    expect(a.code).not.toBe(b.code);
  });

  it('generating a new code invalidates the previous one', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const first = await svc.generateInviteCode(asyncDb, 's1');
    await svc.generateInviteCode(asyncDb, 's1'); // second code
    // first code must no longer be active
    await expect(
      svc.joinWithCode(asyncDb, { sessionId: 's1', code: first.code, displayName: 'Spieler' }),
    ).rejects.toThrow();
  });

  it('getActiveInviteCode returns the current active code', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    const active = await svc.getActiveInviteCode(asyncDb, 's1');
    expect(active).not.toBeNull();
    expect(active!.code).toBe(invite.code);
  });

  it('getActiveInviteCode returns null before any code is generated', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const active = await svc.getActiveInviteCode(asyncDb, 's1');
    expect(active).toBeNull();
  });
});

// ── Player join with invite code ──────────────────────────────────────────────

describe('M10-S02 joinWithCode', () => {
  it('returns a PlayerToken on valid code', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    const tok = await svc.joinWithCode(asyncDb, {
      sessionId: 's1',
      code: invite.code,
      displayName: 'Aragorn',
    });
    expect(typeof tok.token).toBe('string');
    expect(tok.sessionId).toBe('s1');
    expect(tok.token.length).toBeGreaterThanOrEqual(20);
  });

  it('token is different from the invite code (not a copy)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    const tok = await svc.joinWithCode(asyncDb, {
      sessionId: 's1',
      code: invite.code,
      displayName: 'Frodo',
    });
    expect(tok.token).not.toBe(invite.code);
  });

  it('rejects with invalid code (random string not in DB)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await expect(
      svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'WRONG-CODE', displayName: 'X' }),
    ).rejects.toThrow();
  });

  it('rejects with code for wrong session', async () => {
    const { db, asyncDb } = createDb();
    // seed second session
    db.prepare(
      `INSERT INTO sessions (id, title, created_at) VALUES ('s2', 'Andere Runde', datetime('now'))`,
    ).run();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    await expect(
      svc.joinWithCode(asyncDb, { sessionId: 's2', code: invite.code, displayName: 'X' }),
    ).rejects.toThrow();
  });
});

// ── Token auth middleware ─────────────────────────────────────────────────────

describe('M10-S02 validateToken', () => {
  it('resolves to PlayerToken for valid token in the right session', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    const tok = await svc.joinWithCode(asyncDb, {
      sessionId: 's1',
      code: invite.code,
      displayName: 'Valid',
    });
    const result = await svc.validateToken(asyncDb, { sessionId: 's1', token: tok.token });
    expect(result.token).toBe(tok.token);
  });

  it('throws for completely unknown token', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await expect(
      svc.validateToken(asyncDb, { sessionId: 's1', token: 'ghost-token' }),
    ).rejects.toThrow();
  });

  it('throws for token belonging to a different session', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO sessions (id, title, created_at) VALUES ('s2', 'Andere Runde', datetime('now'))`,
    ).run();
    const svc = await getSvc();
    const invite = await svc.generateInviteCode(asyncDb, 's1');
    const tok = await svc.joinWithCode(asyncDb, {
      sessionId: 's1',
      code: invite.code,
      displayName: 'X',
    });
    await expect(
      svc.validateToken(asyncDb, { sessionId: 's2', token: tok.token }),
    ).rejects.toThrow();
  });
});

// ── HTML escaping (AC: user strings escaped before exported HTML) ─────────────

describe('M10-S02 escapeHtml', () => {
  it('escapes < > & " \'', async () => {
    const svc = await getSvc();
    expect(svc.escapeHtml('<script>alert("x")</script>')).not.toContain('<script>');
    expect(svc.escapeHtml('<b>bold</b>')).toBe('&lt;b&gt;bold&lt;/b&gt;');
    expect(svc.escapeHtml('a & b')).toBe('a &amp; b');
    expect(svc.escapeHtml('"quote"')).toContain('&quot;');
  });

  it('returns plain text unchanged', async () => {
    const svc = await getSvc();
    expect(svc.escapeHtml('hello world')).toBe('hello world');
  });

  it('double escaping does NOT occur (only one pass)', async () => {
    const svc = await getSvc();
    const once = svc.escapeHtml('<b>');
    const twice = svc.escapeHtml(once);
    expect(twice).not.toBe(once); // &lt;b&gt; → &amp;lt;b&amp;gt; → different
  });
});
