// @vitest-environment node
// M10 #299: Token-Bewegungsrechte (dm/players/owner) — server-enforced
// See: https://github.com/Djimon/WorldBrain/issues/299
//
// V1 default: controller='players' → any approved player may move any token.
// Optional DM-lock (needs-decision) tested structurally where spec is clear.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { applyMapSchema } from '../core_data/map-schema';

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  applyMapSchema(db);
  // seed session + approved player
  db.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s1','R',datetime('now'))`).run();
  db.prepare(`INSERT INTO players (id,display_name,created_at) VALUES ('p1','Ara',datetime('now'))`).run();
  db.prepare(
    `INSERT INTO session_players (session_id,player_id,token_hash,invite_status,joined_at)
     VALUES ('s1','p1','h1','approved',datetime('now'))`,
  ).run();
  // seed a map + layer + token (controller='players' = V1 default)
  db.prepare(`INSERT INTO maps (id,title,created_at) VALUES ('m1','Test',datetime('now'))`).run();
  db.prepare(`INSERT INTO map_layers (id,map_id,name,layer_type,visible)
    VALUES ('l1','m1','Base','image',1)`).run();
  // controller/owner_player_id columns added by M10 schema migration (RED until then)
  db.prepare(`INSERT INTO map_tokens (id,layer_id,map_id,x,y,label) VALUES ('t1','l1','m1',100,200,'Hero')`).run();
  // Set controller once column exists (schema migration pending)
  try { db.prepare(`UPDATE map_tokens SET controller='players' WHERE id='t1'`).run(); } catch { /* column not yet */ }
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getSvc() { return import('../src/services/token-move-service'); }

// ── Schema ────────────────────────────────────────────────────────────────────

describe('#299 schema: map_tokens movement-control columns', () => {
  it('map_tokens has a controller column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(map_tokens)`).all() as { name: string }[];
    expect(info.map((r) => r.name)).toContain('controller');
  });

  it('map_tokens has an owner_player_id column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(map_tokens)`).all() as { name: string }[];
    expect(info.map((r) => r.name)).toContain('owner_player_id');
  });

  it('default controller is "players" (V1 default: all approved may move)', () => {
    const { db } = createDb();
    const row = db.prepare(`SELECT dflt_value FROM pragma_table_info('map_tokens') WHERE name='controller'`).get() as { dflt_value: string } | undefined;
    expect(row?.dflt_value).toBe("'players'");
  });
});

// ── canMoveToken (authorization check) ───────────────────────────────────────

describe('#299 canMoveToken — V1 default (controller=players)', () => {
  it('approved player CAN move a token with controller="players"', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'p1',
      tokenId: 't1',
    });
    expect(result).toBe(true);
  });

  it('DM (isDm=true) can ALWAYS move any token', async () => {
    const { asyncDb, db } = createDb();
    // DM-only token
    db.prepare(`UPDATE map_tokens SET controller='dm' WHERE id='t1'`).run();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'dm-user',
      tokenId: 't1',
      isDm: true,
    });
    expect(result).toBe(true);
  });

  it('non-approved player CANNOT move a token (not in session)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'ghost-player',
      tokenId: 't1',
    });
    expect(result).toBe(false);
  });
});

describe('#299 canMoveToken — controller=dm (optional lock)', () => {
  it('approved player CANNOT move a token with controller="dm"', async () => {
    const { asyncDb, db } = createDb();
    db.prepare(`UPDATE map_tokens SET controller='dm' WHERE id='t1'`).run();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'p1',
      tokenId: 't1',
    });
    expect(result).toBe(false);
  });
});

describe('#299 canMoveToken — owner_player_id (optional per-player lock)', () => {
  it('owner player CAN move a token with their own owner_player_id', async () => {
    const { asyncDb, db } = createDb();
    db.prepare(`UPDATE map_tokens SET owner_player_id='p1' WHERE id='t1'`).run();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'p1',
      tokenId: 't1',
    });
    expect(result).toBe(true);
  });

  it('different player CANNOT move a token with another owner_player_id', async () => {
    const { asyncDb, db } = createDb();
    // seed a second player
    db.prepare(`INSERT INTO players (id,display_name,created_at) VALUES ('p2','Leg',datetime('now'))`).run();
    db.prepare(`INSERT INTO session_players (session_id,player_id,token_hash,invite_status,joined_at) VALUES ('s1','p2','h2','approved',datetime('now'))`).run();
    db.prepare(`UPDATE map_tokens SET owner_player_id='p1' WHERE id='t1'`).run();
    const svc = await getSvc();
    const result = await svc.canMoveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'p2',
      tokenId: 't1',
    });
    expect(result).toBe(false);
  });
});

// ── moveToken (persist + Decision 8: server-side) ─────────────────────────────

describe('#299 moveToken — persists + enforces', () => {
  it('approved player can move token (controller=players) — position updated in DB', async () => {
    const { asyncDb, db } = createDb();
    const svc = await getSvc();
    await svc.moveToken(asyncDb, {
      sessionId: 's1',
      requestingPlayerId: 'p1',
      tokenId: 't1',
      toX: 300,
      toY: 400,
    });
    const row = db.prepare(`SELECT x, y FROM map_tokens WHERE id='t1'`).get() as { x: number; y: number };
    expect(row.x).toBe(300);
    expect(row.y).toBe(400);
  });

  it('throws (not persisted) when player is not authorized (controller=dm)', async () => {
    const { asyncDb, db } = createDb();
    db.prepare(`UPDATE map_tokens SET controller='dm' WHERE id='t1'`).run();
    const svc = await getSvc();
    await expect(
      svc.moveToken(asyncDb, {
        sessionId: 's1',
        requestingPlayerId: 'p1',
        tokenId: 't1',
        toX: 999,
        toY: 999,
      }),
    ).rejects.toThrow();
    // position unchanged
    const row = db.prepare(`SELECT x, y FROM map_tokens WHERE id='t1'`).get() as { x: number; y: number };
    expect(row.x).toBe(100);
    expect(row.y).toBe(200);
  });
});
