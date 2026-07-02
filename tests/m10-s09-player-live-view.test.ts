// @vitest-environment node
// M10-S09: Spieler-Live-Sicht — Server-side Content Filtering
// See: https://github.com/Djimon/WorldBrain/issues/203

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

async function getFilterService() { return import('../src/services/player-content-filter-service'); }

describe('M10-S09 player live view — server-side content filtering', () => {
  describe('source architecture check', () => {
    it('player-content-filter-service.ts exists', () => {
      const src = readFileSync('src/services/player-content-filter-service.ts', 'utf-8');
      expect(src.length).toBeGreaterThan(0);
    });

    it('filter service does not hide content client-side only (no display:none or hidden class logic)', () => {
      const src = readFileSync('src/services/player-content-filter-service.ts', 'utf-8');
      expect(src).not.toContain('display:none');
      expect(src).not.toContain('hidden');
    });

    it('filter service imports from visibility-service (uses server-side resolve)', () => {
      const src = readFileSync('src/services/player-content-filter-service.ts', 'utf-8');
      expect(src).toContain('visibility-service');
    });
  });

  describe('filterEntitiesForPlayer', () => {
    it('is async', async () => {
      const { asyncDb } = createDb();
      const { filterEntitiesForPlayer } = await getFilterService();
      expect(
        filterEntitiesForPlayer({
          database: asyncDb,
          sessionId: 'sess-1',
          entityIds: [],
          context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
        })
      ).toBeInstanceOf(Promise);
    });

    it('returns empty array for empty input', async () => {
      const { asyncDb } = createDb();
      const { filterEntitiesForPlayer } = await getFilterService();
      const result = await filterEntitiesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        entityIds: [],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).toEqual([]);
    });

    it('excludes entities with no visibility override (gm_only default)', async () => {
      const { asyncDb } = createDb();
      const { filterEntitiesForPlayer } = await getFilterService();
      const result = await filterEntitiesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        entityIds: ['ent-secret'],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).not.toContain('ent-secret');
    });

    it('includes entities with player-level visibility override', async () => {
      const { db, asyncDb } = createDb();
      const { filterEntitiesForPlayer } = await getFilterService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-visible', 'player', 'p-1', NULL)`);
      const result = await filterEntitiesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        entityIds: ['ent-visible', 'ent-secret'],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).toContain('ent-visible');
      expect(result).not.toContain('ent-secret');
    });

    it('includes entities visible via group membership', async () => {
      const { db, asyncDb } = createDb();
      const { filterEntitiesForPlayer } = await getFilterService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'entity', 'ent-group', 'group', NULL, 'grp-1')`);
      const result = await filterEntitiesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        entityIds: ['ent-group'],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: ['grp-1'] },
      });
      expect(result).toContain('ent-group');
    });
  });

  describe('filterImages follows same rules as text', () => {
    it('filterImagesForPlayer exists and is async', async () => {
      const { asyncDb } = createDb();
      const { filterImagesForPlayer } = await getFilterService();
      expect(
        filterImagesForPlayer({
          database: asyncDb,
          sessionId: 'sess-1',
          imageIds: [],
          context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
        })
      ).toBeInstanceOf(Promise);
    });

    it('image with no override is excluded (same gm_only default)', async () => {
      const { asyncDb } = createDb();
      const { filterImagesForPlayer } = await getFilterService();
      const result = await filterImagesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        imageIds: ['img-secret'],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).not.toContain('img-secret');
    });

    it('image with player override is included', async () => {
      const { db, asyncDb } = createDb();
      const { filterImagesForPlayer } = await getFilterService();
      db.exec(`INSERT INTO session_visibility_overrides (session_id, target_type, target_id, scope, player_id, group_id)
               VALUES ('sess-1', 'image', 'img-1', 'player', 'p-1', NULL)`);
      const result = await filterImagesForPlayer({
        database: asyncDb,
        sessionId: 'sess-1',
        imageIds: ['img-1'],
        context: { session_id: 'sess-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).toContain('img-1');
    });
  });

  describe('live push: visibility change event', () => {
    it('player-content-filter-service.ts exports an onVisibilityChanged callback/hook', () => {
      const src = readFileSync('src/services/player-content-filter-service.ts', 'utf-8');
      expect(src).toMatch(/onVisibilityChanged|visibilityChanged|VisibilityChangedCallback/);
    });
  });
});
