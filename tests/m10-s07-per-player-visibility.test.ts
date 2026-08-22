// @vitest-environment node
// M10-S07 (rebuild): Per-Spieler/Gruppen-Visibility
// See: https://github.com/Djimon/WorldBrain/issues/356

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
// 1. Schema: session_visibility_overrides table
// ---------------------------------------------------------------------------

describe('M10-S07 Visibility overrides schema', () => {
  it('session_visibility_overrides table exists with campaign_id, target_type, target_id, scope', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('session_visibility_overrides')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('campaign_id');
      expect(names).toContain('target_type');
      expect(names).toContain('target_id');
      expect(names).toContain('scope');
    } finally {
      db.close();
    }
  });

  it('session_visibility_overrides has player_id and group_id columns', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('session_visibility_overrides')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('player_id');
      expect(names).toContain('group_id');
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Visibility resolution: player + group overrides
// ---------------------------------------------------------------------------

describe('M10-S07 Visibility resolution', () => {
  async function getVisibilityService() {
    return import('../src/services/visibility-service');
  }

  it('default without override is gm_only', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getVisibilityService();
      const result = await svc.resolveSessionVisibility(asyncDb, {
        campaignId: 'camp-1',
        targetType: 'entity',
        targetId: 'ent-1',
        playerId: 'p-1',
        groupIds: [],
      });
      expect(result).toBe('gm_only');
    } finally {
      db.close();
    }
  });

  it('direct player override makes content visible', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getVisibilityService();
      await asyncDb.execute(
        `INSERT INTO session_visibility_overrides (campaign_id, target_type, target_id, scope, player_id) VALUES (?, ?, ?, ?, ?)`,
        ['camp-1', 'entity', 'ent-1', 'player', 'p-1'],
      );
      const result = await svc.resolveSessionVisibility(asyncDb, {
        campaignId: 'camp-1',
        targetType: 'entity',
        targetId: 'ent-1',
        playerId: 'p-1',
        groupIds: [],
      });
      expect(result).not.toBe('gm_only');
    } finally {
      db.close();
    }
  });

  it('group override makes content visible for group member', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getVisibilityService();
      await asyncDb.execute(
        `INSERT INTO session_visibility_overrides (campaign_id, target_type, target_id, scope, group_id) VALUES (?, ?, ?, ?, ?)`,
        ['camp-1', 'entity', 'ent-1', 'group', 'grp-1'],
      );
      const result = await svc.resolveSessionVisibility(asyncDb, {
        campaignId: 'camp-1',
        targetType: 'entity',
        targetId: 'ent-1',
        playerId: 'p-1',
        groupIds: ['grp-1'],
      });
      expect(result).not.toBe('gm_only');
    } finally {
      db.close();
    }
  });

  it('campaign isolation: override in campaign A not visible in campaign B', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getVisibilityService();
      await asyncDb.execute(
        `INSERT INTO session_visibility_overrides (campaign_id, target_type, target_id, scope, player_id) VALUES (?, ?, ?, ?, ?)`,
        ['camp-A', 'entity', 'ent-1', 'player', 'p-1'],
      );
      const result = await svc.resolveSessionVisibility(asyncDb, {
        campaignId: 'camp-B',
        targetType: 'entity',
        targetId: 'ent-1',
        playerId: 'p-1',
        groupIds: [],
      });
      expect(result).toBe('gm_only');
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 3. VisibilityContext extended with campaign_id
// ---------------------------------------------------------------------------

describe('M10-S07 VisibilityContext shape', () => {
  it('VisibilityContext includes campaign_id in its type', () => {
    const source = readFileSync('src/services/visibility-service.ts', 'utf-8');
    expect(source).toMatch(/campaign_id/);
  });
});
