// @vitest-environment node
// M10-S04 (rebuild): Spieler-Gruppen (campaign-scoped)
// See: https://github.com/Djimon/WorldBrain/issues/353

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
// 1. Schema: player_groups + group_members
// ---------------------------------------------------------------------------

describe('M10-S04 Player groups schema', () => {
  it('player_groups has id, campaign_id, name', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('player_groups')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('campaign_id');
      expect(names).toContain('name');
    } finally {
      db.close();
    }
  });

  it('player_groups does NOT have session_id (replaced by campaign_id)', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('player_groups')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).not.toContain('session_id');
    } finally {
      db.close();
    }
  });

  it('group_members table has group_id, player_id', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('group_members')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('group_id');
      expect(names).toContain('player_id');
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Service: Group CRUD (campaign-scoped)
// ---------------------------------------------------------------------------

describe('M10-S04 Player groups service', () => {
  async function getGroupsService() {
    return import('../src/services/player-groups-service');
  }

  it('createGroup with campaign_id returns a group', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getGroupsService();
      const g = await svc.createGroup({
        database: asyncDb,
        campaignId: 'camp-1',
        name: 'Party A',
      });
      expect(g).toHaveProperty('id');
      expect(g.campaign_id).toBe('camp-1');
      expect(g.name).toBe('Party A');
    } finally {
      db.close();
    }
  });

  it('renameGroup updates the name', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getGroupsService();
      const g = await svc.createGroup({ database: asyncDb, campaignId: 'camp-1', name: 'Old' });
      await svc.renameGroup({ database: asyncDb, groupId: g.id, name: 'New' });
      const rows = db
        .prepare('SELECT name FROM player_groups WHERE id = ?')
        .all(g.id) as { name: string }[];
      expect(rows[0].name).toBe('New');
    } finally {
      db.close();
    }
  });

  it('deleteGroup removes group and memberships', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getGroupsService();
      const g = await svc.createGroup({ database: asyncDb, campaignId: 'camp-1', name: 'Gone' });
      await svc.addMember({ database: asyncDb, groupId: g.id, playerId: 'p-1' });
      await svc.deleteGroup({ database: asyncDb, groupId: g.id });
      const groups = db.prepare('SELECT * FROM player_groups WHERE id = ?').all(g.id);
      const members = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(g.id);
      expect(groups.length).toBe(0);
      expect(members.length).toBe(0);
    } finally {
      db.close();
    }
  });

  it('a player can belong to multiple groups', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getGroupsService();
      const g1 = await svc.createGroup({ database: asyncDb, campaignId: 'camp-1', name: 'A' });
      const g2 = await svc.createGroup({ database: asyncDb, campaignId: 'camp-1', name: 'B' });
      await svc.addMember({ database: asyncDb, groupId: g1.id, playerId: 'p-1' });
      await svc.addMember({ database: asyncDb, groupId: g2.id, playerId: 'p-1' });
      const rows = db
        .prepare('SELECT * FROM group_members WHERE player_id = ?')
        .all('p-1');
      expect(rows.length).toBe(2);
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Campaign isolation: groups from campaign A not visible in campaign B
// ---------------------------------------------------------------------------

describe('M10-S04 Campaign isolation', () => {
  async function getGroupsService() {
    return import('../src/services/player-groups-service');
  }

  it('listGroups returns only groups for the requested campaign', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getGroupsService();
      await svc.createGroup({ database: asyncDb, campaignId: 'camp-A', name: 'Alpha' });
      await svc.createGroup({ database: asyncDb, campaignId: 'camp-B', name: 'Beta' });
      const groupsA = await svc.listGroups({ database: asyncDb, campaignId: 'camp-A' });
      expect(groupsA.length).toBe(1);
      expect(groupsA[0].name).toBe('Alpha');
    } finally {
      db.close();
    }
  });
});
