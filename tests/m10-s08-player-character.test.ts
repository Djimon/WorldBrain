// @vitest-environment node
// M10-S08: Spieler-Charaktererstellung im Join-Flow
// See: https://github.com/Djimon/WorldBrain/issues/202
//
// RED: player-character-service stubs throw. Schema columns (is_player_character,
// player_id on base_entities) may not exist yet.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

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
  // seed session + players
  db.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s1','Runde',datetime('now'))`).run();
  db.prepare(`INSERT INTO players (id,display_name,created_at) VALUES ('p1','Aragorn',datetime('now')),('p2','Legolas',datetime('now'))`).run();
  db.prepare(
    `INSERT INTO session_players (session_id,player_id,token_hash,status,joined_at)
     VALUES ('s1','p1','h1','active',datetime('now')),('s1','p2','h2','active',datetime('now'))`,
  ).run();
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getSvc() { return import('../src/services/player-character-service'); }

// ── Schema ────────────────────────────────────────────────────────────────────

describe('M10-S08 schema: player character columns', () => {
  it('base_entities has is_player_character column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(base_entities)`).all() as { name: string }[];
    expect(info.map((r) => r.name)).toContain('is_player_character');
  });

  it('base_entities has player_id column (owner attribution)', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(base_entities)`).all() as { name: string }[];
    expect(info.map((r) => r.name)).toContain('player_id');
  });
});

// ── Service ───────────────────────────────────────────────────────────────────

describe('M10-S08 createPlayerCharacter', () => {
  it('returns a PlayerCharacter with entityId, playerId, sessionId, name', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const pc = await svc.createPlayerCharacter(asyncDb, {
      sessionId: 's1',
      playerId: 'p1',
      name: 'Helden-Aragorn',
    });
    expect(pc.entityId).toBeTruthy();
    expect(pc.playerId).toBe('p1');
    expect(pc.sessionId).toBe('s1');
    expect(pc.name).toBe('Helden-Aragorn');
  });

  it('stores is_player_character=1 + player_id on the base entity', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    const pc = await svc.createPlayerCharacter(asyncDb, {
      sessionId: 's1',
      playerId: 'p1',
      name: 'Char',
    });
    const row = db
      .prepare(`SELECT is_player_character, player_id FROM base_entities WHERE id=?`)
      .get(pc.entityId) as { is_player_character: number; player_id: string };
    expect(row.is_player_character).toBe(1);
    expect(row.player_id).toBe('p1');
  });

  it('without system plugin: creates entity with basic fields only', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const pc = await svc.createPlayerCharacter(asyncDb, {
      sessionId: 's1',
      playerId: 'p1',
      name: 'Basic',
      systemPluginId: null,
    });
    expect(pc.entityId).toBeTruthy();
    expect(pc.name).toBe('Basic');
  });

  it('throws when player already has a character in this session (D10: exactly 1)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'First' });
    await expect(
      svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'Second' }),
    ).rejects.toThrow();
  });

  it('two different players can each create one character (isoliert)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const c1 = await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'A' });
    const c2 = await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p2', name: 'B' });
    expect(c1.entityId).not.toBe(c2.entityId);
  });
});

describe('M10-S08 getPlayerCharacter', () => {
  it('returns null before character is created', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const result = await svc.getPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1' });
    expect(result).toBeNull();
  });

  it('returns the character after creation', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'Held' });
    const result = await svc.getPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1' });
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Held');
  });
});

describe('M10-S08 updatePlayerCharacter', () => {
  it('allows player to update own character', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const pc = await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'Alt' });
    await expect(
      svc.updatePlayerCharacter(asyncDb, { entityId: pc.entityId, requestingPlayerId: 'p1', name: 'Neu' }),
    ).resolves.toBeUndefined();
  });

  it('throws when a player tries to edit another player\'s character (D20)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const pc = await svc.createPlayerCharacter(asyncDb, { sessionId: 's1', playerId: 'p1', name: 'Char' });
    await expect(
      svc.updatePlayerCharacter(asyncDb, { entityId: pc.entityId, requestingPlayerId: 'p2', name: 'Gehackt' }),
    ).rejects.toThrow();
  });
});
