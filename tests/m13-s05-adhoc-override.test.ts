// @vitest-environment node
// M13-S05: Ad-hoc Session-Override
// See: https://github.com/Djimon/WorldBrain/issues/240

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

describe('M13-S05 Ad-hoc session override', () => {
  async function getService() {
    return import('../src/services/session-overlay-service');
  }

  it('addSessionOverride creates an implicit session-local module', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.addSessionOverride(asyncDb, {
        sessionId: 's1',
        entry: { target: 'bands:attack', op: 'patch', value: { crit: 19 } },
      });
      const overrides = await svc.listSessionOverrides(asyncDb, 's1');
      expect(overrides).toHaveLength(1);
      expect(overrides[0].target).toBe('bands:attack');
    } finally {
      db.close();
    }
  });

  it('session-local override only affects its own session', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.addSessionOverride(asyncDb, {
        sessionId: 's1',
        entry: { target: 'bands:attack', op: 'patch', value: { crit: 19 } },
      });
      const s2overrides = await svc.listSessionOverrides(asyncDb, 's2');
      expect(s2overrides).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('session override uses same Entry form as modules', async () => {
    const svc = await getService();
    expect(svc).toHaveProperty('addSessionOverride');
    expect(svc).toHaveProperty('listSessionOverrides');
  });

  it('promote converts session override to a named sharable module', async () => {
    const { asyncDb, db } = createDatabase();
    try {
      const svc = await getService();
      await svc.addSessionOverride(asyncDb, {
        sessionId: 's1',
        entry: { target: 'bands:attack', op: 'patch', value: { crit: 19 } },
      });
      const module = await svc.promoteToModule(asyncDb, {
        sessionId: 's1',
        name: 'Crit on 19',
        baseSystemId: 'dnd5e_srd',
      });
      expect(module.id).toBeTruthy();
      expect(module.name).toBe('Crit on 19');
    } finally {
      db.close();
    }
  });
});
