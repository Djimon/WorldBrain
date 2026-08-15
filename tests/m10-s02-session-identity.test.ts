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

// ── #340 D24: Auto-Join — kein Approve-Gate ───────────────────────────────────
// RED: Schema hat noch invite_status (nicht status); joinWithCode setzt kein
// session_players-Eintrag mit status='active'; kick() existiert nicht.

describe('#340 D24 joinWithCode → sofort status=active (kein pending)', () => {
  it('joinWithCode inserts a session_players row with status=active', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('ABC12345','s1',datetime('now'),1)`,
    ).run();
    const svc = await getSvc();
    await svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'ABC12345', displayName: 'Frodo' });
    // After join: session_players must have status='active' — NOT 'pending' or 'approved'
    const rows = db
      .prepare(`SELECT status FROM session_players WHERE session_id='s1'`)
      .all() as { status: string }[];
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('active');
  });

  it('joinWithCode does NOT create a pending row (no invite_status column)', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('XY123456','s1',datetime('now'),1)`,
    ).run();
    const svc = await getSvc();
    await svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'XY123456', displayName: 'Sam' });
    // Must NOT have any row with invite_status (old column should no longer exist)
    const info = db.prepare(`PRAGMA table_info(session_players)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).not.toContain('invite_status');
    expect(cols).toContain('status');
  });

  it('joinWithCode returns a token immediately (no pending state)', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('ZZ987654','s1',datetime('now'),1)`,
    ).run();
    const svc = await getSvc();
    const result = await svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'ZZ987654', displayName: 'Gandalf' });
    expect(result.token).toBeTruthy();
    expect(result.playerId).toBeTruthy();
  });
});

describe('#340 D24 kick() — invalidiert Token und setzt status=kicked', () => {
  it('kick() function is exported from session-identity-service', async () => {
    const svc = await getSvc();
    expect(typeof svc.kick).toBe('function');
  });

  it('kick(db, playerId, sessionId) sets session_players.status=kicked', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('KK001122','s1',datetime('now'),1)`,
    ).run();
    const svc = await getSvc();
    const joined = await svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'KK001122', displayName: 'Boromir' });
    await svc.kick(asyncDb, { playerId: joined.playerId, sessionId: 's1' });
    const rows = db
      .prepare(`SELECT status FROM session_players WHERE session_id='s1' AND player_id=?`)
      .all(joined.playerId) as { status: string }[];
    expect(rows[0].status).toBe('kicked');
  });

  it('kicked player token is rejected by validateToken', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('KK334455','s1',datetime('now'),1)`,
    ).run();
    const svc = await getSvc();
    const joined = await svc.joinWithCode(asyncDb, { sessionId: 's1', code: 'KK334455', displayName: 'Saruman' });
    await svc.kick(asyncDb, { playerId: joined.playerId, sessionId: 's1' });
    await expect(
      svc.validateToken(asyncDb, { sessionId: 's1', token: joined.token }),
    ).rejects.toThrow();
  });
});
