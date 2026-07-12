// @vitest-environment node
// M14-S10: Derived World-State-Projektion
// See: https://github.com/Djimon/WorldBrain/issues/265
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

describe('M14-S10 derived world-state projection', () => {
  describe('siege@2 then destroyed@4 — state folds up to the given day', () => {
    it('state@3 has siege but not the village-destroyed set', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id: siegeId } = await createEventEntity(asyncDb, { title: 'Siege Begins', start_day: 2, event_kind: 'single' });
        await addEffect(asyncDb, siegeId, { day: 2, target: 'world:siege', verb: 'set_flag' });
        const { id: villageId } = await createEventEntity(asyncDb, { title: 'Village Destroyed', start_day: 4, event_kind: 'single' });
        await addEffect(asyncDb, villageId, { day: 4, target: 'world:village', verb: 'set', value: 'destroyed' });

        const state3 = await worldStateAt(asyncDb, 3);
        expect(state3.get('world:siege')).toBeTruthy();
        expect(state3.has('world:village')).toBe(false);
      } finally {
        db.close();
      }
    });

    it('state@5 has both siege and village=destroyed', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id: siegeId } = await createEventEntity(asyncDb, { title: 'Siege Begins', start_day: 2, event_kind: 'single' });
        await addEffect(asyncDb, siegeId, { day: 2, target: 'world:siege', verb: 'set_flag' });
        const { id: villageId } = await createEventEntity(asyncDb, { title: 'Village Destroyed', start_day: 4, event_kind: 'single' });
        await addEffect(asyncDb, villageId, { day: 4, target: 'world:village', verb: 'set', value: 'destroyed' });

        const state5 = await worldStateAt(asyncDb, 5);
        expect(state5.get('world:siege')).toBeTruthy();
        expect(state5.get('world:village')).toBe('destroyed');
      } finally {
        db.close();
      }
    });
  });

  describe('gain/spend accumulate numerically', () => {
    it('gain(x,2)@1 + gain(x,3)@2 → x=5 at day 3', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Gains', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 1, target: 'world:x', verb: 'gain', value: 2 });
        await addEffect(asyncDb, id, { day: 2, target: 'world:x', verb: 'gain', value: 3 });

        const state = await worldStateAt(asyncDb, 3);
        expect(state.get('world:x')).toBe(5);
      } finally {
        db.close();
      }
    });

    it('spend subtracts numerically', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Gain then Spend', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 1, target: 'world:y', verb: 'gain', value: 10 });
        await addEffect(asyncDb, id, { day: 2, target: 'world:y', verb: 'spend', value: 4 });

        const state = await worldStateAt(asyncDb, 3);
        expect(state.get('world:y')).toBe(6);
      } finally {
        db.close();
      }
    });
  });

  describe('clear removes the target from the map', () => {
    it('set then clear leaves the target absent', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Set then Clear', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 1, target: 'world:z', verb: 'set', value: 'active' });
        await addEffect(asyncDb, id, { day: 2, target: 'world:z', verb: 'clear' });

        const state = await worldStateAt(asyncDb, 3);
        expect(state.has('world:z')).toBe(false);
      } finally {
        db.close();
      }
    });
  });

  describe('negative day is correct', () => {
    it('an assertion at day=-5 is included in the fold at day=-5, excluded at day=-6', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Ancient Omen', start_day: -5, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: -5, target: 'world:omen', verb: 'set_flag' });

        const stateAtOmen = await worldStateAt(asyncDb, -5);
        expect(stateAtOmen.get('world:omen')).toBeTruthy();
        const stateBefore = await worldStateAt(asyncDb, -6);
        expect(stateBefore.has('world:omen')).toBe(false);
      } finally {
        db.close();
      }
    });
  });

  describe('same-day tie-break: deterministic by effect index within an event', () => {
    it('two effects on the same target at the same day apply in list order (later index wins)', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { worldStateAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Two Same-Day Effects', start_day: 7, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 7, target: 'world:tie', verb: 'set', value: 'first' });
        await addEffect(asyncDb, id, { day: 7, target: 'world:tie', verb: 'set', value: 'second' });

        const state = await worldStateAt(asyncDb, 7);
        expect(state.get('world:tie')).toBe('second');
      } finally {
        db.close();
      }
    });
  });

  describe('entityStatusAt', () => {
    it('returns the last set status <= day, or undefined before any assertion', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect } = await getEventEffectsService();
      const { entityStatusAt } = await getWorldStateProjection();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'NPC Dies', start_day: 10, event_kind: 'single' });
        await addEffect(asyncDb, id, { day: 10, target: 'entity:npc_1#status', verb: 'set', value: 'dead' });

        expect(await entityStatusAt(asyncDb, 'npc_1', 9)).toBeUndefined();
        expect(await entityStatusAt(asyncDb, 'npc_1', 10)).toBe('dead');
      } finally {
        db.close();
      }
    });
  });
});
