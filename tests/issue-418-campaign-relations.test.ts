// @vitest-environment node
// #418: campaign-local relations mirror world relations but live in their own table
// (campaign_relations), scoped by campaign. A DM in a campaign creates these without
// touching the world `relations`; promote absorbs one into the world (clean absorb).
// Real SQLite. See: https://github.com/Djimon/WorldBrain/issues/418

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyRelationsSchema } from '../core_data/relations-schema';
import {
  addRelation, addCampaignRelation, getRelations,
  deactivateCampaignRelation, reactivateCampaignRelation, promoteCampaignRelation,
} from '../src/services/relation-service';

function makeDb() {
  const raw = new DatabaseSync(':memory:');
  return {
    raw,
    db: {
      execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
      select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
        raw.prepare(sql).all(...(args as never[])) as T[],
    },
  };
}
async function open() {
  const { raw, db } = makeDb();
  await applyRelationsSchema(db);
  return { raw, db };
}
function count(raw: DatabaseSync, table: string): number {
  return (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe('#418 campaign-local relations', () => {
  it('addCampaignRelation writes campaign_relations, not the world relations table', async () => {
    const { raw, db } = await open();
    await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'b', relation_type: 'ally_of', visibility: 'public' });
    expect(count(raw, 'campaign_relations')).toBe(1);
    expect(count(raw, 'relations')).toBe(0);
  });

  it('getRelations merges world + this campaign\'s relations (tagged), world-only without a campaign', async () => {
    const { db } = await open();
    await addRelation(db, { source_id: 'a', target_id: 'w', relation_type: 'ally_of', visibility: 'public' });
    await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'c', relation_type: 'ally_of', visibility: 'public' });

    const inCampaign = await getRelations(db, 'a', { includeInactive: true }, 'camp-1');
    const targets = inCampaign.map((r) => r.target_id);
    expect(targets).toContain('w');
    expect(targets).toContain('c');
    const campRow = inCampaign.find((r) => r.target_id === 'c');
    expect(campRow?.campaignId).toBe('camp-1');
    const worldRow = inCampaign.find((r) => r.target_id === 'w');
    expect(worldRow?.campaignId).toBeUndefined();

    const worldOnly = await getRelations(db, 'a', { includeInactive: true });
    expect(worldOnly.map((r) => r.target_id)).toEqual(['w']);

    const otherCampaign = await getRelations(db, 'a', { includeInactive: true }, 'camp-2');
    expect(otherCampaign.map((r) => r.target_id)).toEqual(['w']);
  });

  it('deactivate/reactivate toggle the campaign relation', async () => {
    const { db } = await open();
    const { id } = await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'b', relation_type: 'ally_of', visibility: 'public' });
    await deactivateCampaignRelation(db, id);
    let rows = await getRelations(db, 'a', { includeInactive: false }, 'camp-1');
    expect(rows.find((r) => r.id === id)).toBeUndefined();
    await reactivateCampaignRelation(db, id);
    rows = await getRelations(db, 'a', { includeInactive: false }, 'camp-1');
    expect(rows.find((r) => r.id === id)).toBeTruthy();
  });

  it('promote absorbs the campaign relation into the world and removes it from campaign_relations', async () => {
    const { raw, db } = await open();
    const { id } = await addCampaignRelation(db, { campaignId: 'camp-1', source_id: 'a', target_id: 'b', relation_type: 'ally_of', visibility: 'public' });
    await promoteCampaignRelation(db, { campaignId: 'camp-1', relationId: id });
    expect(count(raw, 'relations')).toBe(1);
    expect(count(raw, 'campaign_relations')).toBe(0);
    // Now a world relation (visible without a campaign).
    const worldOnly = await getRelations(db, 'a', { includeInactive: true });
    expect(worldOnly.map((r) => r.target_id)).toContain('b');
  });
});
