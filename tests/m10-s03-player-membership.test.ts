// @vitest-environment node
// M10-S03: Spieler-Mitgliedschaft — Schema & Services
// See: https://github.com/Djimon/WorldBrain/issues/197

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf-8');

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getService() { return import('../src/services/player-membership-service'); }

describe('M10-S03 player membership schema & services', () => {
  describe('schema', () => {
    it('runtime schema creates a players table', () => {
      const { db } = createDb();
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='players'`).all();
      expect(tables.length).toBe(1);
    });

    it('players table has id, display_name, created_at columns', () => {
      const { db } = createDb();
      const info = db.prepare(`PRAGMA table_info(players)`).all() as { name: string }[];
      const cols = info.map(r => r.name);
      expect(cols).toContain('id');
      expect(cols).toContain('display_name');
      expect(cols).toContain('created_at');
    });

    it('runtime schema creates a session_players table', () => {
      const { db } = createDb();
      const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='session_players'`).all();
      expect(tables.length).toBe(1);
    });

    it('session_players table has session_id, player_id, token_hash, invite_status, joined_at', () => {
      const { db } = createDb();
      const info = db.prepare(`PRAGMA table_info(session_players)`).all() as { name: string }[];
      const cols = info.map(r => r.name);
      expect(cols).toContain('session_id');
      expect(cols).toContain('player_id');
      expect(cols).toContain('token_hash');
      expect(cols).toContain('invite_status');
      expect(cols).toContain('joined_at');
    });
  });

  describe('createPlayer', () => {
    it('is async', async () => {
      const { asyncDb } = createDb();
      const { createPlayer } = await getService();
      expect(createPlayer({ database: asyncDb, displayName: 'Alice' })).toBeInstanceOf(Promise);
    });

    it('returns a player with id and display_name', async () => {
      const { asyncDb } = createDb();
      const { createPlayer } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      expect(player.id).toBeTruthy();
      expect(player.display_name).toBe('Alice');
    });

    it('persists player to DB', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Bob' });
      const row = db.prepare('SELECT * FROM players WHERE id = ?').get(player.id);
      expect(row).toBeTruthy();
    });
  });

  describe('requestJoin', () => {
    it('creates a session_players row with invite_status = pending', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer, requestJoin } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: player.id, tokenHash: 'hash-abc' });
      const row = db.prepare(`SELECT invite_status FROM session_players WHERE player_id = ?`).get(player.id) as { invite_status: string } | undefined;
      expect(row?.invite_status).toBe('pending');
    });
  });

  describe('approve / reject / kick', () => {
    it('approve sets invite_status to approved', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer, requestJoin, approve } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: player.id, tokenHash: 'h' });
      await approve({ database: asyncDb, sessionId: 'sess-1', playerId: player.id });
      const row = db.prepare(`SELECT invite_status FROM session_players WHERE player_id = ?`).get(player.id) as { invite_status: string };
      expect(row.invite_status).toBe('approved');
    });

    it('reject sets invite_status to rejected', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer, requestJoin, reject } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: player.id, tokenHash: 'h' });
      await reject({ database: asyncDb, sessionId: 'sess-1', playerId: player.id });
      const row = db.prepare(`SELECT invite_status FROM session_players WHERE player_id = ?`).get(player.id) as { invite_status: string };
      expect(row.invite_status).toBe('rejected');
    });

    it('kick sets invite_status to kicked', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer, requestJoin, approve, kick } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: player.id, tokenHash: 'h' });
      await approve({ database: asyncDb, sessionId: 'sess-1', playerId: player.id });
      await kick({ database: asyncDb, sessionId: 'sess-1', playerId: player.id });
      const row = db.prepare(`SELECT invite_status FROM session_players WHERE player_id = ?`).get(player.id) as { invite_status: string };
      expect(row.invite_status).toBe('kicked');
    });
  });

  describe('listSessionPlayers', () => {
    it('returns only approved players by default', async () => {
      const { asyncDb } = createDb();
      const { createPlayer, requestJoin, approve, listSessionPlayers } = await getService();
      const p1 = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      const p2 = await createPlayer({ database: asyncDb, displayName: 'Bob' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: p1.id, tokenHash: 'h1' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: p2.id, tokenHash: 'h2' });
      await approve({ database: asyncDb, sessionId: 'sess-1', playerId: p1.id });
      const list = await listSessionPlayers({ database: asyncDb, sessionId: 'sess-1' });
      expect(list.map(p => p.player_id)).toContain(p1.id);
      expect(list.map(p => p.player_id)).not.toContain(p2.id);
    });

    it('returns empty array when no approved players', async () => {
      const { asyncDb } = createDb();
      const { listSessionPlayers } = await getService();
      const list = await listSessionPlayers({ database: asyncDb, sessionId: 'sess-empty' });
      expect(list).toEqual([]);
    });

    it('one player token belongs to exactly one session', async () => {
      const { db, asyncDb } = createDb();
      const { createPlayer, requestJoin } = await getService();
      const player = await createPlayer({ database: asyncDb, displayName: 'Alice' });
      await requestJoin({ database: asyncDb, sessionId: 'sess-1', playerId: player.id, tokenHash: 'unique-hash' });
      const rows = db.prepare(`SELECT * FROM session_players WHERE player_id = ?`).all(player.id);
      expect(rows.length).toBe(1);
    });
  });

  describe('type safety', () => {
    it('player-membership-service.ts does not cast database as never or unknown', () => {
      const src = readFileSync('src/services/player-membership-service.ts', 'utf-8');
      expect(src).not.toContain('as never');
      expect(src).not.toContain('as unknown');
    });
  });
});
