// @vitest-environment node
// M10-S20: Campaign-Klammer + campaign_id-Keying (Foundation D23)
// See: https://github.com/Djimon/WorldBrain/issues/337
//
// RED: campaigns table + campaign_id columns do not exist in schema.sql yet;
// campaign-service stubs throw. All tests fail until the implementer adds the
// schema and service logic.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

const runtimeSchemaSql = readFileSync(
  new URL('../src/data/runtime/schema.sql', import.meta.url),
  'utf-8',
);

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
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getService() {
  return import('../src/services/campaign-service');
}

// ── Schema ───────────────────────────────────────────────────────────────────

describe('M10-S20 schema: campaigns table', () => {
  it('runtime schema creates a campaigns table', () => {
    const { db } = createDb();
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='campaigns'`)
      .all();
    expect(tables.length).toBe(1);
  });

  it('campaigns table has id, title, created_at', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(campaigns)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('id');
    expect(cols).toContain('title');
    expect(cols).toContain('created_at');
  });
});

describe('M10-S20 schema: campaign_id on existing tables', () => {
  it('sessions has a campaign_id column (D23: session = Termin-Layer einer Campaign)', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });

  it('campaign_entity_overrides has a campaign_id column (D23: un-gekeyt → campaign-gekeyt)', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(campaign_entity_overrides)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });

  it('session_players has a campaign_id column (Roster ist campaign-scoped, nicht session-scoped)', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(session_players)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });

  it('player_groups has a campaign_id column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(player_groups)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });

  it('session_visibility_overrides has a campaign_id column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(session_visibility_overrides)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });

  it('campaign_notes has a campaign_id column', () => {
    const { db } = createDb();
    const info = db.prepare(`PRAGMA table_info(campaign_notes)`).all() as { name: string }[];
    const cols = info.map((r) => r.name);
    expect(cols).toContain('campaign_id');
  });
});

// ── Campaign CRUD ─────────────────────────────────────────────────────────────

describe('M10-S20 campaign CRUD', () => {
  it('createCampaign returns a Campaign with id, title, created_at', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const c = await svc.createCampaign(asyncDb, { title: 'Herbst-Kampagne' });
    expect(c.id).toMatch(/^[0-9a-f-]{36}$/); // UUID
    expect(c.title).toBe('Herbst-Kampagne');
    expect(c.created_at).toBeTruthy();
  });

  it('listCampaigns returns created campaigns', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    await svc.createCampaign(asyncDb, { title: 'Alpha' });
    await svc.createCampaign(asyncDb, { title: 'Beta' });
    const list = await svc.listCampaigns(asyncDb);
    expect(list.length).toBe(2);
    expect(list.map((c) => c.title)).toContain('Alpha');
    expect(list.map((c) => c.title)).toContain('Beta');
  });

  it('getCampaign returns the campaign by id', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const created = await svc.createCampaign(asyncDb, { title: 'Kap' });
    const found = await svc.getCampaign(asyncDb, created.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('getCampaign returns null for unknown id', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const found = await svc.getCampaign(asyncDb, 'nonexistent');
    expect(found).toBeNull();
  });

  it('deleteCampaign removes the campaign', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const c = await svc.createCampaign(asyncDb, { title: 'ToDelete' });
    await svc.deleteCampaign(asyncDb, c.id);
    const found = await svc.getCampaign(asyncDb, c.id);
    expect(found).toBeNull();
  });

  it('eine Welt kann mehrere Campaigns tragen (listCampaigns zeigt alle)', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const campaigns = await Promise.all([
      svc.createCampaign(asyncDb, { title: 'Gruppe A' }),
      svc.createCampaign(asyncDb, { title: 'Gruppe B' }),
      svc.createCampaign(asyncDb, { title: 'Gruppe C' }),
    ]);
    const list = await svc.listCampaigns(asyncDb);
    expect(list.length).toBe(3);
    const ids = list.map((c) => c.id);
    for (const c of campaigns) expect(ids).toContain(c.id);
  });
});

// ── Campaign-Isolation (D23: Campaign A sieht Campaign Bs Overrides nicht) ──

describe('M10-S20 campaign isolation', () => {
  it('upsertCampaignOverride stores override scoped to campaign', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const campA = await svc.createCampaign(asyncDb, { title: 'A' });
    await svc.upsertCampaignOverride(asyncDb, {
      campaignId: campA.id,
      entityId: 'e1',
      patchJson: '{"hp":10}',
    });
    const overrides = await svc.getCampaignOverrides(asyncDb, campA.id);
    expect(overrides.length).toBe(1);
    expect(overrides[0].entity_id).toBe('e1');
  });

  it('Campaign A overrides are NOT visible in Campaign B (isolation)', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const campA = await svc.createCampaign(asyncDb, { title: 'A' });
    const campB = await svc.createCampaign(asyncDb, { title: 'B' });
    await svc.upsertCampaignOverride(asyncDb, {
      campaignId: campA.id,
      entityId: 'e1',
      patchJson: '{"hp":10}',
    });
    const overridesB = await svc.getCampaignOverrides(asyncDb, campB.id);
    expect(overridesB.length).toBe(0);
  });

  it('same entity can have different overrides in two campaigns', async () => {
    const { asyncDb } = createDb();
    const svc = await getService();
    const campA = await svc.createCampaign(asyncDb, { title: 'A' });
    const campB = await svc.createCampaign(asyncDb, { title: 'B' });
    await svc.upsertCampaignOverride(asyncDb, {
      campaignId: campA.id,
      entityId: 'e1',
      patchJson: '{"hp":10}',
    });
    await svc.upsertCampaignOverride(asyncDb, {
      campaignId: campB.id,
      entityId: 'e1',
      patchJson: '{"hp":99}',
    });
    const oA = await svc.getCampaignOverrides(asyncDb, campA.id);
    const oB = await svc.getCampaignOverrides(asyncDb, campB.id);
    expect(JSON.parse(oA[0].patch_json).hp).toBe(10);
    expect(JSON.parse(oB[0].patch_json).hp).toBe(99);
  });

  it('Basis-Welt bleibt unberührt durch Campaign-Overrides (base_entities unverändert)', async () => {
    const { asyncDb, db } = createDb();
    const svc = await getService();
    // seed a base entity
    db.prepare(
      `INSERT INTO base_entities (id,type,title,summary,aliases_json,properties_json,body_json,visibility,created_at,updated_at)
       VALUES ('e1','Character','Hero','','[]','{}','{}','public',datetime('now'),datetime('now'))`,
    ).run();
    const camp = await svc.createCampaign(asyncDb, { title: 'X' });
    await svc.upsertCampaignOverride(asyncDb, {
      campaignId: camp.id,
      entityId: 'e1',
      patchJson: '{"title":"Villain"}',
    });
    // base entity unchanged
    const base = db
      .prepare(`SELECT title FROM base_entities WHERE id='e1'`)
      .get() as { title: string };
    expect(base.title).toBe('Hero');
  });
});
