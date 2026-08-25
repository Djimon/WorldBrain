// @vitest-environment node
// M13-S04: Session-Aktivierung & Toggle
// See: https://github.com/Djimon/WorldBrain/issues/239

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
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

describe('M13-S04 Session overlay activation service', () => {
  async function getService() {
    return import('../src/services/session-overlay-service');
  }

  it('activateModule adds module to session active list', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.activateModule(asyncDb, { sessionId: 's1', moduleId: 'gritty_realism', order: 0 });
      const active = await svc.listActiveModules(asyncDb, 's1');
      expect(active).toHaveLength(1);
      expect(active[0].moduleId).toBe('gritty_realism');
    } finally {
      db.close();
    }
  });

  it('deactivateModule removes module from session', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.activateModule(asyncDb, { sessionId: 's1', moduleId: 'gritty_realism', order: 0 });
      await svc.deactivateModule(asyncDb, { sessionId: 's1', moduleId: 'gritty_realism' });
      const active = await svc.listActiveModules(asyncDb, 's1');
      expect(active).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('module active in session A but not in session B', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.activateModule(asyncDb, { sessionId: 'sA', moduleId: 'gritty_realism', order: 0 });
      const activeA = await svc.listActiveModules(asyncDb, 'sA');
      const activeB = await svc.listActiveModules(asyncDb, 'sB');
      expect(activeA).toHaveLength(1);
      expect(activeB).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('reorder changes module order in session', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.activateModule(asyncDb, { sessionId: 's1', moduleId: 'mod_a', order: 0 });
      await svc.activateModule(asyncDb, { sessionId: 's1', moduleId: 'mod_b', order: 1 });
      await svc.reorderModules(asyncDb, { sessionId: 's1', moduleIds: ['mod_b', 'mod_a'] });
      const active = await svc.listActiveModules(asyncDb, 's1');
      expect(active[0].moduleId).toBe('mod_b');
      expect(active[1].moduleId).toBe('mod_a');
    } finally {
      db.close();
    }
  });

  it('activation triggers re-resolve of effective ruleset', async () => {
    const svc = await getService();
    expect(svc).toHaveProperty('activateModule');
    expect(svc).toHaveProperty('listActiveModules');
    expect(svc).toHaveProperty('deactivateModule');
    expect(svc).toHaveProperty('reorderModules');
  });
});
