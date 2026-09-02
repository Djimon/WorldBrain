// @vitest-environment node
// #415: campaign-created entities live entirely in a campaign_entity_overrides row
// (campaign_created=1, no base_entities row) until an explicit promote absorbs them into
// the world. Real SQLite + real schema.sql — no mocks of the data layer.
// See: https://github.com/Djimon/WorldBrain/issues/415

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { getEffectiveEntity, listEntitiesByType } from '../src/services/entity-service';
import {
  createCampaignEntity,
  isCampaignCreated,
  updateCampaignCreatedEntity,
  listCampaignCreatedEntities,
  promoteOverride,
} from '../src/services/campaign-override-service';
import { createCampaignEventEntity, listEventEntities } from '../src/services/event-entity-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

function countBase(db: DatabaseSync, id: string): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM base_entities WHERE id = ?').get(id) as { n: number }).n;
}

describe('#415 campaign-created entities', () => {
  it('createCampaignEntity writes a campaign_created override and NO base row', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const id = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Improv NSC' } });
      expect(countBase(db, id)).toBe(0);
      const rows = db.prepare('SELECT campaign_created, patch_json FROM campaign_entity_overrides WHERE entity_id = ?').all(id) as { campaign_created: number; patch_json: string }[];
      expect(rows.length).toBe(1);
      expect(rows[0].campaign_created).toBe(1);
      expect(JSON.parse(rows[0].patch_json).title).toBe('Improv NSC');
    } finally { db.close(); }
  });

  it('getEffectiveEntity synthesizes a campaign-created entity without a base row', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const id = await createCampaignEntity(asyncDb, {
        campaignId: 'camp-1',
        entity: { type: 'Location', title: 'Hidden Vault', properties: { depth: 3 } },
      });
      const res = await getEffectiveEntity({ database: asyncDb, entityId: id });
      expect(res.found).toBe(true);
      if (res.found) {
        expect(res.entity.type).toBe('Location');
        expect(res.entity.title).toBe('Hidden Vault');
        expect(res.entity.properties.depth).toBe(3);
      }
    } finally { db.close(); }
  });

  it('listEntitiesByType includes it WITH campaignId, excludes it WITHOUT', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const id = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Campaign NSC' } });
      const inCampaign = await listEntitiesByType({ database: asyncDb, type: 'Character', campaignId: 'camp-1' });
      expect(inCampaign.map((e) => e.id)).toContain(id);
      const worldOnly = await listEntitiesByType({ database: asyncDb, type: 'Character' });
      expect(worldOnly.map((e) => e.id)).not.toContain(id);
      const otherCampaign = await listEntitiesByType({ database: asyncDb, type: 'Character', campaignId: 'camp-2' });
      expect(otherCampaign.map((e) => e.id)).not.toContain(id);
    } finally { db.close(); }
  });

  it('createCampaignEventEntity + listEventEntities: event shows only in its campaign', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const { id } = await createCampaignEventEntity(asyncDb, { campaignId: 'camp-1', title: 'Ambush', start_day: 42, event_kind: 'single' });
      expect(countBase(db, id)).toBe(0);
      const inCampaign = await listEventEntities(asyncDb, 'camp-1');
      const found = inCampaign.find((e) => e.id === id);
      expect(found).toBeTruthy();
      expect(found?.start_day).toBe(42);
      const worldOnly = await listEventEntities(asyncDb);
      expect(worldOnly.map((e) => e.id)).not.toContain(id);
    } finally { db.close(); }
  });

  it('updateCampaignCreatedEntity edits the entity in place (no base row appears)', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const id = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Old Name', properties: { hp: 5 } } });
      await updateCampaignCreatedEntity(asyncDb, { campaignId: 'camp-1', entityId: id, patch: { title: 'New Name', properties: { hp: 12 } } });
      expect(countBase(db, id)).toBe(0);
      const res = await getEffectiveEntity({ database: asyncDb, entityId: id });
      expect(res.found).toBe(true);
      if (res.found) {
        expect(res.entity.title).toBe('New Name');
        expect(res.entity.properties.hp).toBe(12);
      }
    } finally { db.close(); }
  });

  it('promote ABSORBS the campaign-created entity into the world and removes the override row', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const id = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Promotable', properties: { hp: 7 } } });
      await promoteOverride(asyncDb, { campaignId: 'camp-1', entityId: id });
      // Now a real world entity...
      expect(countBase(db, id)).toBe(1);
      const base = db.prepare('SELECT type, title, properties_json FROM base_entities WHERE id = ?').get(id) as { type: string; title: string; properties_json: string };
      expect(base.type).toBe('Character');
      expect(base.title).toBe('Promotable');
      expect(JSON.parse(base.properties_json).hp).toBe(7);
      // ...and no longer campaign-created (override row gone → clean absorb).
      expect(await isCampaignCreated(asyncDb, { campaignId: 'camp-1', entityId: id })).toBe(false);
      expect((await listCampaignCreatedEntities(asyncDb, 'camp-1')).length).toBe(0);
      // It now appears in the world list (no campaignId needed).
      const worldOnly = await listEntitiesByType({ database: asyncDb, type: 'Character' });
      expect(worldOnly.map((e) => e.id)).toContain(id);
    } finally { db.close(); }
  });
});
