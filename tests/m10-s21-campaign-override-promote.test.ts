// @vitest-environment node
// M10-S21: Campaign-Override-Default + Promote-Schalter (D23)
// See: https://github.com/Djimon/WorldBrain/issues/338
//
// ⚠️ Granularität (per-Feld vs ganze Entity) = needs-decision → Tests nehmen
//    ganze properties_json als Patch-Einheit an (einfachste Variante).
// RED: campaign-override-service stubs throw.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

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
  // seed base entity + two campaigns
  db.prepare(
    `INSERT INTO base_entities (id,type,title,summary,aliases_json,properties_json,body_json,visibility,created_at,updated_at)
     VALUES ('e1','Character','Hero','','[]','{"hp":10}','{}','public',datetime('now'),datetime('now'))`,
  ).run();
  db.prepare(`INSERT INTO campaigns (id,title,created_at) VALUES ('cA','Camp A',datetime('now')),('cB','Camp B',datetime('now'))`).run();
  return { db, asyncDb: makeAsyncDb(db) };
}

async function getSvc() { return import('../src/services/campaign-override-service'); }

// ── applyCampaignOverride ─────────────────────────────────────────────────────

describe('M10-S21 applyCampaignOverride', () => {
  it('does NOT modify base_entities (Basis-Welt unberührt)', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, {
      campaignId: 'cA',
      entityId: 'e1',
      patchJson: '{"hp":99}',
    });
    const base = db
      .prepare(`SELECT properties_json FROM base_entities WHERE id='e1'`)
      .get() as { properties_json: string };
    expect(JSON.parse(base.properties_json).hp).toBe(10);
  });

  it('writes a campaign_entity_overrides row keyed to the campaign', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, {
      campaignId: 'cA',
      entityId: 'e1',
      patchJson: '{"hp":50}',
    });
    const rows = db
      .prepare(`SELECT * FROM campaign_entity_overrides WHERE campaign_id='cA' AND entity_id='e1'`)
      .all() as { patch_json: string }[];
    expect(rows.length).toBe(1);
    expect(JSON.parse(rows[0].patch_json).hp).toBe(50);
  });

  it('Campaign A override is NOT visible in Campaign B', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, {
      campaignId: 'cA',
      entityId: 'e1',
      patchJson: '{"hp":77}',
    });
    const rowsB = db
      .prepare(`SELECT * FROM campaign_entity_overrides WHERE campaign_id='cB' AND entity_id='e1'`)
      .all();
    expect(rowsB.length).toBe(0);
  });

  it('calling twice updates the existing override (idempotent upsert)', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":50}' });
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":75}' });
    const rows = db
      .prepare(`SELECT patch_json FROM campaign_entity_overrides WHERE campaign_id='cA' AND entity_id='e1'`)
      .all() as { patch_json: string }[];
    expect(rows.length).toBe(1);
    expect(JSON.parse(rows[0].patch_json).hp).toBe(75);
  });
});

// ── getEffectiveForCampaign ───────────────────────────────────────────────────

describe('M10-S21 getEffectiveForCampaign', () => {
  it('returns base entity values when no campaign override exists', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    const eff = await svc.getEffectiveForCampaign(asyncDb, { campaignId: 'cA', entityId: 'e1' });
    expect(eff).not.toBeNull();
    expect(eff!.properties['hp']).toBe(10);
  });

  it('returns merged (base + override) when override exists', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, {
      campaignId: 'cA',
      entityId: 'e1',
      patchJson: '{"hp":99,"status":"wounded"}',
    });
    const eff = await svc.getEffectiveForCampaign(asyncDb, { campaignId: 'cA', entityId: 'e1' });
    expect(eff!.properties['hp']).toBe(99);
    expect(eff!.properties['status']).toBe('wounded');
  });

  it('Campaign B sees only base, not Campaign A override', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":99}' });
    const effB = await svc.getEffectiveForCampaign(asyncDb, { campaignId: 'cB', entityId: 'e1' });
    expect(effB!.properties['hp']).toBe(10);
  });
});

// ── promoteOverrideToWorld ────────────────────────────────────────────────────

describe('M10-S21 promoteOverrideToWorld', () => {
  it('writes the override into base_entities (all campaigns now see it)', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":42}' });
    await svc.promoteOverrideToWorld(asyncDb, { campaignId: 'cA', entityId: 'e1' });
    const base = db
      .prepare(`SELECT properties_json FROM base_entities WHERE id='e1'`)
      .get() as { properties_json: string };
    expect(JSON.parse(base.properties_json).hp).toBe(42);
  });

  it('after promote, Campaign B also sees the promoted value (via base)', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":42}' });
    await svc.promoteOverrideToWorld(asyncDb, { campaignId: 'cA', entityId: 'e1' });
    const effB = await svc.getEffectiveForCampaign(asyncDb, { campaignId: 'cB', entityId: 'e1' });
    expect(effB!.properties['hp']).toBe(42);
  });

  it('override is consumed after promote (no longer in campaign_entity_overrides)', async () => {
    const { db, asyncDb } = createDb();
    const svc = await getSvc();
    await svc.applyCampaignOverride(asyncDb, { campaignId: 'cA', entityId: 'e1', patchJson: '{"hp":42}' });
    await svc.promoteOverrideToWorld(asyncDb, { campaignId: 'cA', entityId: 'e1' });
    const rows = db
      .prepare(`SELECT * FROM campaign_entity_overrides WHERE campaign_id='cA' AND entity_id='e1'`)
      .all();
    expect(rows.length).toBe(0);
  });

  it('throws when no override exists to promote', async () => {
    const { asyncDb } = createDb();
    const svc = await getSvc();
    await expect(
      svc.promoteOverrideToWorld(asyncDb, { campaignId: 'cA', entityId: 'e1' }),
    ).rejects.toThrow();
  });
});
