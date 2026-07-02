// @vitest-environment node
// M10-S04: Spieler-Gruppen — Schema & Services
// See: https://github.com/Djimon/WorldBrain/issues/198

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

async function getService() { return import('../src/services/player-groups-service'); }

describe('M10-S04 player groups schema & services', () => {
  describe('schema', () => {
    it('runtime schema creates player_groups table', () => {
      const { db } = createDb();
      const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='player_groups'`).all();
      expect(rows.length).toBe(1);
    });

    it('player_groups has id, session_id, name columns', () => {
      const { db } = createDb();
      const info = db.prepare(`PRAGMA table_info(player_groups)`).all() as { name: string }[];
      const cols = info.map(r => r.name);
      expect(cols).toContain('id');
      expect(cols).toContain('session_id');
      expect(cols).toContain('name');
    });

    it('runtime schema creates player_group_members table', () => {
      const { db } = createDb();
      const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='player_group_members'`).all();
      expect(rows.length).toBe(1);
    });

    it('player_group_members has group_id, player_id columns', () => {
      const { db } = createDb();
      const info = db.prepare(`PRAGMA table_info(player_group_members)`).all() as { name: string }[];
      const cols = info.map(r => r.name);
      expect(cols).toContain('group_id');
      expect(cols).toContain('player_id');
    });
  });

  describe('createGroup', () => {
    it('is async', async () => {
      const { asyncDb } = createDb();
      const { createGroup } = await getService();
      expect(createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Party A' })).toBeInstanceOf(Promise);
    });

    it('returns group with id, session_id, name', async () => {
      const { asyncDb } = createDb();
      const { createGroup } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Party A' });
      expect(group.id).toBeTruthy();
      expect(group.session_id).toBe('sess-1');
      expect(group.name).toBe('Party A');
    });

    it('persists group to player_groups table', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Party A' });
      const row = db.prepare('SELECT * FROM player_groups WHERE id = ?').get(group.id);
      expect(row).toBeTruthy();
    });

    it('groups are scoped to their session', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup } = await getService();
      await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Group X' });
      await createGroup({ database: asyncDb, sessionId: 'sess-2', name: 'Group Y' });
      const rows = db.prepare(`SELECT * FROM player_groups WHERE session_id = 'sess-1'`).all();
      expect(rows.length).toBe(1);
    });
  });

  describe('renameGroup', () => {
    it('updates the group name in DB', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup, renameGroup } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Old Name' });
      await renameGroup({ database: asyncDb, groupId: group.id, name: 'New Name' });
      const row = db.prepare('SELECT name FROM player_groups WHERE id = ?').get(group.id) as { name: string };
      expect(row.name).toBe('New Name');
    });
  });

  describe('deleteGroup', () => {
    it('removes the group from DB', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup, deleteGroup } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Doomed Group' });
      await deleteGroup({ database: asyncDb, groupId: group.id });
      const row = db.prepare('SELECT * FROM player_groups WHERE id = ?').get(group.id);
      expect(row).toBeUndefined();
    });
  });

  describe('addMember / removeMember', () => {
    it('addMember creates a player_group_members row', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup, addMember } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'A' });
      await addMember({ database: asyncDb, groupId: group.id, playerId: 'player-1' });
      const row = db.prepare(`SELECT * FROM player_group_members WHERE group_id = ? AND player_id = ?`).get(group.id, 'player-1');
      expect(row).toBeTruthy();
    });

    it('removeMember deletes the player_group_members row', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup, addMember, removeMember } = await getService();
      const group = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'A' });
      await addMember({ database: asyncDb, groupId: group.id, playerId: 'player-1' });
      await removeMember({ database: asyncDb, groupId: group.id, playerId: 'player-1' });
      const row = db.prepare(`SELECT * FROM player_group_members WHERE group_id = ? AND player_id = ?`).get(group.id, 'player-1');
      expect(row).toBeUndefined();
    });

    it('a player can be in multiple groups', async () => {
      const { db, asyncDb } = createDb();
      const { createGroup, addMember } = await getService();
      const g1 = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'G1' });
      const g2 = await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'G2' });
      await addMember({ database: asyncDb, groupId: g1.id, playerId: 'player-1' });
      await addMember({ database: asyncDb, groupId: g2.id, playerId: 'player-1' });
      const rows = db.prepare(`SELECT * FROM player_group_members WHERE player_id = 'player-1'`).all();
      expect(rows.length).toBe(2);
    });
  });

  describe('listGroups', () => {
    it('returns only groups for the given session', async () => {
      const { asyncDb } = createDb();
      const { createGroup, listGroups } = await getService();
      await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Alpha' });
      await createGroup({ database: asyncDb, sessionId: 'sess-1', name: 'Beta' });
      await createGroup({ database: asyncDb, sessionId: 'sess-2', name: 'Other' });
      const groups = await listGroups({ database: asyncDb, sessionId: 'sess-1' });
      expect(groups.length).toBe(2);
      expect(groups.every(g => g.session_id === 'sess-1')).toBe(true);
    });

    it('returns empty array when session has no groups', async () => {
      const { asyncDb } = createDb();
      const { listGroups } = await getService();
      expect(await listGroups({ database: asyncDb, sessionId: 'sess-empty' })).toEqual([]);
    });
  });

  describe('type safety', () => {
    it('player-groups-service.ts does not cast database as never or unknown', () => {
      const src = readFileSync('src/services/player-groups-service.ts', 'utf-8');
      expect(src).not.toContain('as never');
    });
  });
});
