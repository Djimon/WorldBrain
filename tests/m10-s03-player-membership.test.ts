// @vitest-environment node
// M10-S03 (rebuild): Spieler-Mitgliedschaft — Schema & Services (campaign-scoped)
// See: https://github.com/Djimon/WorldBrain/issues/352

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
// 1. Schema: players + session_players tables
// ---------------------------------------------------------------------------

describe('M10-S03 Player membership schema', () => {
  it('players table has id, display_name, created_at', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('players')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('display_name');
      expect(names).toContain('created_at');
    } finally {
      db.close();
    }
  });

  it('session_players has campaign_id, player_id, token_hash, status, joined_at', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('session_players')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('campaign_id');
      expect(names).toContain('player_id');
      expect(names).toContain('token_hash');
      expect(names).toContain('status');
      expect(names).toContain('joined_at');
    } finally {
      db.close();
    }
  });

  it('session_players.status does not allow pending or rejected', () => {
    const schema = runtimeSchemaSql;
    const spBlock = schema.match(/CREATE TABLE.*session_players[\s\S]*?;/i)?.[0] ?? '';
    expect(spBlock).not.toMatch(/pending/i);
    expect(spBlock).not.toMatch(/rejected/i);
  });
});

// ---------------------------------------------------------------------------
// 2. Service: player-membership-service.ts
// ---------------------------------------------------------------------------

describe('M10-S03 Player membership service', () => {
  async function getMembershipService() {
    return import('../src/services/player-membership-service');
  }

  it('createPlayer returns a player with id and display_name', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      const p = await svc.createPlayer(asyncDb, { displayName: 'Alice' });
      expect(p).toHaveProperty('id');
      expect(p.display_name).toBe('Alice');
    } finally {
      db.close();
    }
  });

  it('joinWithCode creates active session_players row', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      await svc.joinWithCode(asyncDb, {
        campaignId: 'camp-1',
        playerId: 'p-1',
        tokenHash: 'hash-abc',
      });
      const rows = db
        .prepare('SELECT status FROM session_players WHERE campaign_id = ?')
        .all('camp-1') as { status: string }[];
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('active');
    } finally {
      db.close();
    }
  });

  it('kick sets status to kicked', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      await svc.joinWithCode(asyncDb, {
        campaignId: 'camp-1',
        playerId: 'p-1',
        tokenHash: 'hash-abc',
      });
      await svc.kick(asyncDb, { campaignId: 'camp-1', playerId: 'p-1' });
      const rows = db
        .prepare('SELECT status FROM session_players WHERE campaign_id = ? AND player_id = ?')
        .all('camp-1', 'p-1') as { status: string }[];
      expect(rows[0].status).toBe('kicked');
    } finally {
      db.close();
    }
  });

  it('kicked player token is invalidated (token_hash cleared)', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      await svc.joinWithCode(asyncDb, {
        campaignId: 'camp-1',
        playerId: 'p-1',
        tokenHash: 'hash-abc',
      });
      await svc.kick(asyncDb, { campaignId: 'camp-1', playerId: 'p-1' });
      const rows = db
        .prepare('SELECT token_hash FROM session_players WHERE campaign_id = ? AND player_id = ?')
        .all('camp-1', 'p-1') as { token_hash: string | null }[];
      expect(rows[0].token_hash).toBeFalsy();
    } finally {
      db.close();
    }
  });

  it('listCampaignPlayers returns only players from that campaign', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      await svc.joinWithCode(asyncDb, {
        campaignId: 'camp-A',
        playerId: 'p-1',
        tokenHash: 'h1',
      });
      await svc.joinWithCode(asyncDb, {
        campaignId: 'camp-B',
        playerId: 'p-2',
        tokenHash: 'h2',
      });
      const playersA = await svc.listCampaignPlayers(asyncDb, 'camp-A');
      expect(playersA.length).toBe(1);
    } finally {
      db.close();
    }
  });

  it('multiple players per campaign', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getMembershipService();
      await svc.joinWithCode(asyncDb, { campaignId: 'camp-1', playerId: 'p-1', tokenHash: 'h1' });
      await svc.joinWithCode(asyncDb, { campaignId: 'camp-1', playerId: 'p-2', tokenHash: 'h2' });
      const players = await svc.listCampaignPlayers(asyncDb, 'camp-1');
      expect(players.length).toBe(2);
    } finally {
      db.close();
    }
  });

  it('service does not export requestJoin, approve, or reject', async () => {
    const svc = await getMembershipService();
    expect(svc).not.toHaveProperty('requestJoin');
    expect(svc).not.toHaveProperty('approve');
    expect(svc).not.toHaveProperty('reject');
  });
});
