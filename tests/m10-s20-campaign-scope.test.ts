// @vitest-environment node
// M10-S20 (rebuild): Campaign-Klammer + campaign_id-Keying
// See: https://github.com/Djimon/WorldBrain/issues/349

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
// Schema: campaigns table must exist with world_time_start
// ---------------------------------------------------------------------------

describe('M10-S20 Campaign schema', () => {
  it('campaigns table exists with id, title, created_at, world_time_start', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('campaigns')")
        .all() as { name: string }[];
      const names = cols.map((c) => c.name);
      expect(names).toContain('id');
      expect(names).toContain('title');
      expect(names).toContain('created_at');
      expect(names).toContain('world_time_start');
    } finally {
      db.close();
    }
  });

  it('campaign_entity_overrides has campaign_id column', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('campaign_entity_overrides')")
        .all() as { name: string }[];
      expect(cols.map((c) => c.name)).toContain('campaign_id');
    } finally {
      db.close();
    }
  });

  it('campaign_notes has campaign_id column', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('campaign_notes')")
        .all() as { name: string }[];
      expect(cols.map((c) => c.name)).toContain('campaign_id');
    } finally {
      db.close();
    }
  });

  it('invite_codes has campaign_id column', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('invite_codes')")
        .all() as { name: string }[];
      expect(cols.map((c) => c.name)).toContain('campaign_id');
    } finally {
      db.close();
    }
  });

  it('session_players has campaign_id column', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('session_players')")
        .all() as { name: string }[];
      expect(cols.map((c) => c.name)).toContain('campaign_id');
    } finally {
      db.close();
    }
  });

  it('player_groups has campaign_id column', () => {
    const { db } = createDatabase();
    try {
      const cols = db
        .prepare("PRAGMA table_info('player_groups')")
        .all() as { name: string }[];
      expect(cols.map((c) => c.name)).toContain('campaign_id');
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Campaign CRUD
// ---------------------------------------------------------------------------

describe('M10-S20 Campaign CRUD', () => {
  async function getCampaignService() {
    return import('../src/services/campaign-service');
  }

  it('createCampaign persists world_time_start', async () => {
    const { db, asyncDb } = createDatabase();
    try {
      const svc = await getCampaignService();
      const c = await svc.createCampaign(asyncDb, {
        title: 'Frostfall',
        world_time_start: '0001-01-01',
      });
      expect(c.world_time_start).toBe('0001-01-01');
      const row = db
        .prepare('SELECT world_time_start FROM campaigns WHERE id = ?')
        .get(c.id) as { world_time_start: string };
      expect(row.world_time_start).toBe('0001-01-01');
    } finally {
      db.close();
    }
  });

  it('multiple campaigns per world are independent', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getCampaignService();
      const a = await svc.createCampaign(asyncDb, { title: 'A' });
      const b = await svc.createCampaign(asyncDb, { title: 'B' });
      expect(a.id).not.toBe(b.id);
      const all = await svc.listCampaigns(asyncDb);
      expect(all.length).toBe(2);
    } finally {
      db.close();
    }
  });

  it('deleteCampaign removes campaign', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getCampaignService();
      const c = await svc.createCampaign(asyncDb, { title: 'Gone' });
      await svc.deleteCampaign(asyncDb, c.id);
      const result = await svc.getCampaign(asyncDb, c.id);
      expect(result).toBeNull();
    } finally {
      db.close();
    }
  });
});

// ---------------------------------------------------------------------------
// Campaign isolation: overrides scoped to campaign
// ---------------------------------------------------------------------------

describe('M10-S20 Campaign isolation', () => {
  async function getCampaignService() {
    return import('../src/services/campaign-service');
  }

  it('campaign_entity_overrides are isolated between campaigns', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getCampaignService();
      const a = await svc.createCampaign(asyncDb, { title: 'A' });
      const b = await svc.createCampaign(asyncDb, { title: 'B' });

      await svc.upsertCampaignOverride(asyncDb, {
        campaignId: a.id,
        entityId: 'ent-1',
        patchJson: '{"hp":10}',
      });

      const overridesA = await asyncDb.select<{ campaign_id: string }>(
        'SELECT campaign_id FROM campaign_entity_overrides WHERE campaign_id = ?',
        [a.id],
      );
      const overridesB = await asyncDb.select<{ campaign_id: string }>(
        'SELECT campaign_id FROM campaign_entity_overrides WHERE campaign_id = ?',
        [b.id],
      );
      expect(overridesA.length).toBe(1);
      expect(overridesB.length).toBe(0);
    } finally {
      db.close();
    }
  });
});
