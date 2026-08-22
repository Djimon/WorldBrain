// @vitest-environment node
// M10-S17 (rebuild): Session-Zeit + host-seitiges Kalender-Gate
// See: https://github.com/Djimon/WorldBrain/issues/363

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

describe('M10-S17 Session time', () => {
  async function getSessionTimeService() {
    return import('../src/services/session-time-service');
  }

  it('advanceTime moves session-now forward by days', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getSessionTimeService();
      await svc.setSessionNow(asyncDb, { campaignId: 'camp-1', day: 10 });
      await svc.advanceTime(asyncDb, { campaignId: 'camp-1', days: 5 });
      const now = await svc.getSessionNow(asyncDb, 'camp-1');
      expect(now.day).toBe(15);
    } finally {
      db.close();
    }
  });

  it('session-now is persisted (campaign-scoped)', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getSessionTimeService();
      await svc.setSessionNow(asyncDb, { campaignId: 'camp-1', day: 42 });
      const now = await svc.getSessionNow(asyncDb, 'camp-1');
      expect(now.day).toBe(42);
    } finally {
      db.close();
    }
  });
});

describe('M10-S17 Calendar gate (host-side)', () => {
  async function getSessionTimeService() {
    return import('../src/services/session-time-service');
  }

  it('filterEventsBySessionNow excludes future events', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getSessionTimeService();
      await svc.setSessionNow(asyncDb, { campaignId: 'camp-1', day: 10 });
      const events = [
        { id: 'e-past', start_day: 5 },
        { id: 'e-now', start_day: 10 },
        { id: 'e-future', start_day: 20 },
      ];
      const filtered = await svc.filterEventsBySessionNow(asyncDb, {
        campaignId: 'camp-1',
        events,
      });
      expect(filtered.map((e: { id: string }) => e.id)).toContain('e-past');
      expect(filtered.map((e: { id: string }) => e.id)).toContain('e-now');
      expect(filtered.map((e: { id: string }) => e.id)).not.toContain('e-future');
    } finally {
      db.close();
    }
  });

  it('future events never leave the host', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getSessionTimeService();
      await svc.setSessionNow(asyncDb, { campaignId: 'camp-1', day: 1 });
      const filtered = await svc.filterEventsBySessionNow(asyncDb, {
        campaignId: 'camp-1',
        events: [{ id: 'secret', start_day: 999 }],
      });
      expect(filtered).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
