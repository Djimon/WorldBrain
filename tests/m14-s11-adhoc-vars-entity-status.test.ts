// @vitest-environment node
// M14-S11: Ad-hoc World-Variablen & Entity-Status-Timeline
// See: https://github.com/Djimon/WorldBrain/issues/266
//
// Note: pure DatabaseLike service module (no UI component in this story's
// Unit-Tests bullet) — the generic AP-001 "database prop typed as
// DatabaseLike" requirement is satisfied structurally (every function takes
// DatabaseLike, no unknown/as-never casts at call sites); not separately
// re-tested to avoid fabricating a non-existent requirement (AGENTS.md: no
// extrapolation).

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike (same
// pattern as m14-s04-event-entity.test.ts).
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

const runtimeSchemaSql = readFileSync(new URL('../src/data/runtime/schema.sql', import.meta.url), 'utf8');

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function getEventEntityService() { return import('../src/services/event-entity-service'); }
async function getEventEffectsService() { return import('../src/services/event-effects-service'); }
async function getWorldStateProjection() { return import('../src/services/world-state-projection'); }

describe('M14-S11 ad-hoc world variables & entity-status timeline', () => {
  describe('an unknown world:<name> is usable via set without pre-registration', () => {
    it('setting "world:foo" (never seen before) makes it appear in worldStateAt with no registry step', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'First Use of foo', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 1, target: 'world:foo', verb: 'set', value: 'bar' });

        const state = await worldStateAt(asyncDb, 1);
        expect(state.get('world:foo')).toBe('bar');
      } finally {
        db.close();
      }
    });
  });

  describe('listWorldVariables: distinct world:<name> targets actually used', () => {
    it('returns each distinct world variable exactly once, in any order', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { listWorldVariables } = await getWorldStateProjection();
      try {
        const { id: e1 } = await createEventEntity(asyncDb, { title: 'A', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, e1, { day: 1, target: 'world:siege', verb: 'set_flag' });
        const { id: e2 } = await createEventEntity(asyncDb, { title: 'B', start_day: 2, event_kind: 'single' });
        await addEffect(asyncDb, e2, { day: 2, target: 'world:siege', verb: 'clear' });
        await addEffect(asyncDb, e2, { day: 2, target: 'world:harvest', verb: 'gain', value: 1 });

        const vars = await listWorldVariables(asyncDb);
        expect([...vars].sort()).toEqual(['world:harvest', 'world:siege']);
      } finally {
        db.close();
      }
    });

    it('does not include entity:...#status targets, only world: targets', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { listWorldVariables } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'NPC Dies', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 1, target: 'entity:npc_1#status', verb: 'set', value: 'dead' });
        await addEffect(asyncDb, id, { day: 1, target: 'world:battle', verb: 'set_flag' });

        const vars = await listWorldVariables(asyncDb);
        expect(vars).toEqual(['world:battle']);
      } finally {
        db.close();
      }
    });

    it('returns an empty list when no assertions exist yet', async () => {
      const { db, asyncDb } = createDatabase();
      const { listWorldVariables } = await getWorldStateProjection();
      try {
        expect(await listWorldVariables(asyncDb)).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('entity-status timeline: alive@1, dead@10', () => {
    it('entityStatusAt returns "alive" at day 5 and "dead" at day 11', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { entityStatusAt } = await getWorldStateProjection();
      try {
        const { id: birthId } = await createEventEntity(asyncDb, { title: 'NPC Introduced', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, birthId, { day: 1, target: 'entity:npc_2#status', verb: 'set', value: 'alive' });
        const { id: deathId } = await createEventEntity(asyncDb, { title: 'NPC Dies', start_day: 10, event_kind: 'single' });
        await addEffect(asyncDb, deathId, { day: 10, target: 'entity:npc_2#status', verb: 'set', value: 'dead' });

        expect(await entityStatusAt(asyncDb, 'npc_2', 5)).toBe('alive');
        expect(await entityStatusAt(asyncDb, 'npc_2', 11)).toBe('dead');
      } finally {
        db.close();
      }
    });
  });
});
