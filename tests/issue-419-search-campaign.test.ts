// @vitest-environment node
// #419: host/DM-side search is campaign-aware. World entities are always findable; a DM in a
// campaign also finds that campaign's campaign-created entities (#415), tagged with their
// campaign_id. Outside a campaign (edit mode) only world entities are found.
// Real SQLite + real schema.sql. See: https://github.com/Djimon/WorldBrain/issues/419

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { applySearchSchema } from '../core_data/search-schema';
import { rebuildSearchIndex, searchEntities } from '../src/services/search-service';
import { createCampaignEntity } from '../src/services/campaign-override-service';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}
const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

async function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  const asyncDb = makeAsyncDb(raw);
  await applySearchSchema(asyncDb);
  return { db: raw, asyncDb };
}

function insertWorldEntity(db: DatabaseSync, id: string, title: string) {
  db.prepare(
    `INSERT INTO base_entities (id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at)
     VALUES (?, 'Character', ?, '', '[]', '{}', '{"format":"portable_blocks_v1","blocks":[]}', 'public', '2026-01-01', '2026-01-01')`,
  ).run(id, title);
}

describe('#419 campaign-aware search', () => {
  it('DM in a campaign finds world + this campaign\'s campaign-created entities (tagged)', async () => {
    const { db, asyncDb } = await createDatabase();
    try {
      insertWorldEntity(db, 'w1', 'Zoromir the World Sage');
      const cid = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Zoromir Improv Twin' } });
      await rebuildSearchIndex(asyncDb);

      const res = await searchEntities(asyncDb, 'Zoromir', {}, 'camp-1');
      const ids = res.map((r) => r.entityId);
      expect(ids).toContain('w1');
      expect(ids).toContain(cid);
      const created = res.find((r) => r.entityId === cid);
      expect(created?.campaignId).toBe('camp-1');
      const world = res.find((r) => r.entityId === 'w1');
      expect(world?.campaignId).toBeUndefined();
    } finally { db.close(); }
  });

  it('without a campaign (edit mode) only world entities are found', async () => {
    const { db, asyncDb } = await createDatabase();
    try {
      insertWorldEntity(db, 'w1', 'Zoromir the World Sage');
      const cid = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Zoromir Improv Twin' } });
      await rebuildSearchIndex(asyncDb);

      const res = await searchEntities(asyncDb, 'Zoromir', {});
      const ids = res.map((r) => r.entityId);
      expect(ids).toContain('w1');
      expect(ids).not.toContain(cid);
    } finally { db.close(); }
  });

  it('a different campaign does not see camp-1\'s campaign-created entity', async () => {
    const { db, asyncDb } = await createDatabase();
    try {
      const cid = await createCampaignEntity(asyncDb, { campaignId: 'camp-1', entity: { type: 'Character', title: 'Zoromir Improv Twin' } });
      await rebuildSearchIndex(asyncDb);

      const res = await searchEntities(asyncDb, 'Zoromir', {}, 'camp-2');
      expect(res.map((r) => r.entityId)).not.toContain(cid);
    } finally { db.close(); }
  });

  it('applySearchSchema migrates an old entity_search without campaign_id', async () => {
    const raw = new DatabaseSync(':memory:');
    try {
      // Old shape: no campaign_id column.
      raw.exec(`CREATE VIRTUAL TABLE entity_search USING fts5(title, aliases, summary, body, tags, properties_text, entity_id UNINDEXED, entity_type UNINDEXED)`);
      const asyncDb = makeAsyncDb(raw);
      await applySearchSchema(asyncDb);
      // campaign_id now selectable → migrated.
      expect(() => raw.prepare('SELECT campaign_id FROM entity_search LIMIT 0').all()).not.toThrow();
    } finally { raw.close(); }
  });
});
