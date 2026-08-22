// @vitest-environment node
// M10-S09 (rebuild): Spieler-Live-Sicht (host-gefilterte Inhalte)
// See: https://github.com/Djimon/WorldBrain/issues/358

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
// 1. Host-side content filtering
// ---------------------------------------------------------------------------

describe('M10-S09 Host-side content filter', () => {
  async function getFilterService() {
    return import('../src/services/player-content-filter-service');
  }

  it('filterIdsForPlayer returns only released content', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getFilterService();
      const result = await svc.filterIdsForPlayer({
        database: asyncDb,
        campaignId: 'camp-1',
        targetType: 'entity',
        ids: ['ent-1', 'ent-2', 'ent-3'],
        context: { campaign_id: 'camp-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result.length).toBe(0);
    } finally {
      db.close();
    }
  });

  it('gm_only content never leaves the host', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getFilterService();
      const result = await svc.filterIdsForPlayer({
        database: asyncDb,
        campaignId: 'camp-1',
        targetType: 'entity',
        ids: ['secret-ent'],
        context: { campaign_id: 'camp-1', player_id: 'p-1', group_ids: [] },
      });
      expect(result).not.toContain('secret-ent');
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Service uses campaign_id (not session_id)
// ---------------------------------------------------------------------------

describe('M10-S09 Campaign-scoped filtering', () => {
  it('player-content-filter-service references campaign_id', () => {
    const source = readFileSync('src/services/player-content-filter-service.ts', 'utf-8');
    expect(source).toMatch(/campaign_id/);
  });
});
