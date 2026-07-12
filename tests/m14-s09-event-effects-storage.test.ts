// @vitest-environment node
// M14-S09: Effekt-Assertions am Event speichern
// See: https://github.com/Djimon/WorldBrain/issues/264
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

describe('M14-S09 effect assertions stored on an event', () => {
  describe('effect without day defaults to event.start_day', () => {
    it('addEffect without a day writes day=start_day into properties.effects', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Siege Begins', start_day: 42, event_kind: 'single' });
        await addEffect(asyncDb, id, { target: 'world:siege', verb: 'set_flag' });
        const effects = await listEffects(asyncDb, id);
        expect(effects).toEqual([{ day: 42, target: 'world:siege', verb: 'set_flag' }]);
      } finally {
        db.close();
      }
    });
  });

  describe('effect with its own day keeps that day', () => {
    it('addEffect with day=45 keeps day=45, not the event start_day', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Siege Begins', start_day: 42, event_kind: 'phase', end_day: 60 });
        await addEffect(asyncDb, id, { day: 45, target: 'world:siege', verb: 'set_flag' });
        const effects = await listEffects(asyncDb, id);
        expect(effects[0].day).toBe(45);
      } finally {
        db.close();
      }
    });
  });

  describe('multiple effects form a list', () => {
    it('two addEffect calls append two entries, both persisted', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Siege', start_day: 2, event_kind: 'phase', end_day: 4 });
        await addEffect(asyncDb, id, { day: 2, target: 'world:siege', verb: 'set_flag' });
        await addEffect(asyncDb, id, { day: 4, target: 'world:siege', verb: 'clear' });
        const effects = await listEffects(asyncDb, id);
        expect(effects).toHaveLength(2);
        expect(effects.map((e) => e.day)).toEqual([2, 4]);
      } finally {
        db.close();
      }
    });
  });

  describe('invalid target/verb (S08) rejected, not stored', () => {
    it('an invalid target ("session:foo", V1-reserved) is rejected and not persisted', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Bad Effect', start_day: 1, event_kind: 'single' });
        await expect(addEffect(asyncDb, id, { target: 'session:foo', verb: 'set_flag' })).rejects.toThrow();
        const effects = await listEffects(asyncDb, id);
        expect(effects).toEqual([]);
      } finally {
        db.close();
      }
    });

    it('an invalid verb is rejected and not persisted', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Bad Verb', start_day: 1, event_kind: 'single' });
        await expect(addEffect(asyncDb, id, { target: 'world:x', verb: 'teleport' })).rejects.toThrow();
        const effects = await listEffects(asyncDb, id);
        expect(effects).toEqual([]);
      } finally {
        db.close();
      }
    });
  });

  describe('updateEffect', () => {
    it('updates the value at the given index, leaving other effects unchanged', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, updateEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Two Effects', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { target: 'world:a', verb: 'set_flag' });
        await addEffect(asyncDb, id, { target: 'world:b', verb: 'set_flag' });
        await updateEffect(asyncDb, id, 1, { verb: 'clear' });
        const effects = await listEffects(asyncDb, id);
        expect(effects[0].target).toBe('world:a');
        expect(effects[1]).toMatchObject({ target: 'world:b', verb: 'clear' });
      } finally {
        db.close();
      }
    });
  });

  describe('removeEffect', () => {
    it('removes the effect at the given index, shifting the rest', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      const { addEffect, removeEffect, listEffects } = await getEventEffectsService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Three Effects', start_day: 1, event_kind: 'single' });
        await addEffect(asyncDb, id, { target: 'world:a', verb: 'set_flag' });
        await addEffect(asyncDb, id, { target: 'world:b', verb: 'set_flag' });
        await addEffect(asyncDb, id, { target: 'world:c', verb: 'set_flag' });
        await removeEffect(asyncDb, id, 1);
        const effects = await listEffects(asyncDb, id);
        expect(effects.map((e) => e.target)).toEqual(['world:a', 'world:c']);
      } finally {
        db.close();
      }
    });
  });
});
