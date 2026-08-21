// @vitest-environment node
// M10-S21 (rebuild): Campaign-Override-Default + Promote-Schalter
// See: https://github.com/Djimon/WorldBrain/issues/365

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

describe('M10-S21 Campaign override default', () => {
  async function getOverrideService() {
    return import('../src/services/campaign-override-service');
  }

  it('edit in campaign creates an override, not a base change', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getOverrideService();
      await svc.upsertCampaignOverride(asyncDb, {
        campaignId: 'camp-1',
        entityId: 'ent-1',
        patchJson: '{"hp":20}',
      });
      const overrides = await asyncDb.select<{ campaign_id: string }>(
        'SELECT campaign_id FROM campaign_entity_overrides WHERE campaign_id = ?',
        ['camp-1'],
      );
      expect(overrides.length).toBe(1);
      const baseRows = await asyncDb.select<{ properties_json: string }>(
        'SELECT properties_json FROM base_entities WHERE id = ?',
        ['ent-1'],
      );
      expect(baseRows.length).toBe(0);
    } finally {
      db.close();
    }
  });
});

describe('M10-S21 Promote to world', () => {
  async function getOverrideService() {
    return import('../src/services/campaign-override-service');
  }

  it('promoteOverride function exists', async () => {
    const svc = await getOverrideService();
    expect(svc).toHaveProperty('promoteOverride');
  });

  it('promote writes override into base_entities', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getOverrideService();
      db.prepare(
        "INSERT INTO base_entities (id, type, title, summary, aliases_json, properties_json, body_json, visibility, created_at, updated_at) VALUES ('ent-1','Character','Test','','[]','{}','[]','public','2026-01-01','2026-01-01')",
      ).run();
      await svc.upsertCampaignOverride(asyncDb, {
        campaignId: 'camp-1',
        entityId: 'ent-1',
        patchJson: '{"hp":99}',
      });
      await svc.promoteOverride(asyncDb, {
        campaignId: 'camp-1',
        entityId: 'ent-1',
      });
      const base = db
        .prepare('SELECT properties_json FROM base_entities WHERE id = ?')
        .get('ent-1') as { properties_json: string };
      expect(base.properties_json).toMatch(/99/);
    } finally {
      db.close();
    }
  });
});

describe('M10-S21 Promote UI guard', () => {
  it('promote control uses Button or Segmented from primitives', () => {
    const source = readFileSync('src/ui/PromoteControl.tsx', 'utf-8');
    expect(source).toMatch(/import.*(?:Button|Segmented).*from.*primitives/);
  });
});
