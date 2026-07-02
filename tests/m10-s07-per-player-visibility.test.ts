// @vitest-environment node
// M10-S07: Per-Spieler/Gruppen-Visibility — Schema & Services
// See: https://github.com/Djimon/WorldBrain/issues/201

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

async function getVisibilityService() { return import('../src/services/visibility-service'); }

describe('M10-S07 per-player/group visibility schema & services', () => {
  describe('schema', () => {
    it('runtime schema creates session_visibility_overrides table', () => {
      const { db } = createDb();
      const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='session_visibility_overrides'`).all();
      expect(rows.length).toBe(1);
    });

    it('session_visibility_overrides has required columns', () => {
      const { db } = createDb();
      const info = db.prepare(`PRAGMA table_info(session_visibility_overrides)`).all() as { name: string }[];
      const cols = info.map(r => r.name);
      expect(cols).toContain('session_id');
      expect(cols).toContain('target_type');
      expect(cols).toContain('target_id');
      expect(cols).toContain('scope');
      expect(cols).toContain('player_id');
      expect(cols).toContain('group_id');
    });

    it('player_id and group_id are nullable', () => {
      const { db } = createDb();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-1', 'player', 'player-1', NULL)`);
      const row = db.prepare(`SELECT * FROM session_visibility_overrides`).get() as Record<string, unknown>;
      expect(row.player_id).toBe('player-1');
      expect(row.group_id).toBeNull();
    });
  });

  describe('VisibilityContext type', () => {
    it('visibility-service exports VisibilityContext type with session_id, player_id, group_ids', async () => {
      const src = readFileSync('src/services/visibility-service.ts', 'utf-8');
      expect(src).toContain('session_id');
      expect(src).toContain('player_id');
      expect(src).toContain('group_ids');
      expect(src).toContain('VisibilityContext');
    });
  });

  describe('default visibility', () => {
    it('resolveVisibility returns gm_only when no overrides exist', async () => {
      const { asyncDb } = createDb();
      const { resolveVisibility } = await getVisibilityService();
      const result = await resolveVisibility({
        database: asyncDb,
        sessionId: 'sess-1',
        targetType: 'entity',
        targetId: 'ent-1',
        context: { session_id: 'sess-1', player_id: 'player-1', group_ids: [] },
      });
      expect(result).toBe('gm_only');
    });
  });

  describe('player-level override', () => {
    it('player can see target when direct player override exists', async () => {
      const { db, asyncDb } = createDb();
      const { resolveVisibility } = await getVisibilityService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-1', 'player', 'player-1', NULL)`);
      const result = await resolveVisibility({
        database: asyncDb,
        sessionId: 'sess-1',
        targetType: 'entity',
        targetId: 'ent-1',
        context: { session_id: 'sess-1', player_id: 'player-1', group_ids: [] },
      });
      expect(result).not.toBe('gm_only');
    });

    it('player cannot see target via other player override', async () => {
      const { db, asyncDb } = createDb();
      const { resolveVisibility } = await getVisibilityService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-1', 'player', 'player-OTHER', NULL)`);
      const result = await resolveVisibility({
        database: asyncDb,
        sessionId: 'sess-1',
        targetType: 'entity',
        targetId: 'ent-1',
        context: { session_id: 'sess-1', player_id: 'player-1', group_ids: [] },
      });
      expect(result).toBe('gm_only');
    });
  });

  describe('group-level override', () => {
    it('player can see target via group membership override', async () => {
      const { db, asyncDb } = createDb();
      const { resolveVisibility } = await getVisibilityService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-1', 'group', NULL, 'group-1')`);
      const result = await resolveVisibility({
        database: asyncDb,
        sessionId: 'sess-1',
        targetType: 'entity',
        targetId: 'ent-1',
        context: { session_id: 'sess-1', player_id: 'player-1', group_ids: ['group-1'] },
      });
      expect(result).not.toBe('gm_only');
    });

    it('player cannot see target via group they are not in', async () => {
      const { db, asyncDb } = createDb();
      const { resolveVisibility } = await getVisibilityService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-1', 'group', NULL, 'group-OTHER')`);
      const result = await resolveVisibility({
        database: asyncDb,
        sessionId: 'sess-1',
        targetType: 'entity',
        targetId: 'ent-1',
        context: { session_id: 'sess-1', player_id: 'player-1', group_ids: ['group-1'] },
      });
      expect(result).toBe('gm_only');
    });
  });

  describe('setVisibilityOverride', () => {
    it('is async', async () => {
      const { asyncDb } = createDb();
      const { setVisibilityOverride } = await getVisibilityService();
      expect(
        setVisibilityOverride({ database: asyncDb, sessionId: 'sess-1', targetType: 'entity', targetId: 'e-1', scope: 'player', playerId: 'p-1' })
      ).toBeInstanceOf(Promise);
    });

    it('persists override to session_visibility_overrides', async () => {
      const { db, asyncDb } = createDb();
      const { setVisibilityOverride } = await getVisibilityService();
      await setVisibilityOverride({ database: asyncDb, sessionId: 'sess-1', targetType: 'entity', targetId: 'e-1', scope: 'player', playerId: 'p-1' });
      const row = db.prepare(`SELECT * FROM session_visibility_overrides WHERE target_id = 'e-1' AND player_id = 'p-1'`).get();
      expect(row).toBeTruthy();
    });
  });

  describe('clearVisibilityOverride', () => {
    it('removes the override from DB', async () => {
      const { db, asyncDb } = createDb();
      const { setVisibilityOverride, clearVisibilityOverride } = await getVisibilityService();
      await setVisibilityOverride({ database: asyncDb, sessionId: 'sess-1', targetType: 'entity', targetId: 'e-1', scope: 'player', playerId: 'p-1' });
      await clearVisibilityOverride({ database: asyncDb, sessionId: 'sess-1', targetType: 'entity', targetId: 'e-1', playerId: 'p-1' });
      const row = db.prepare(`SELECT * FROM session_visibility_overrides WHERE target_id = 'e-1' AND player_id = 'p-1'`).get();
      expect(row).toBeUndefined();
    });
  });
});
