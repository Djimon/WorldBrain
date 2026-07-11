// @vitest-environment node
// M14-S04: Event-Entity-Modell & Ablösung der events-Tabelle
// See: https://github.com/Djimon/WorldBrain/issues/259
//
// Note: pure DatabaseLike service module (no UI component in this story's
// Unit-Tests bullet) — the generic AP-001 "database prop typed as
// DatabaseLike" requirement is satisfied structurally (every function below
// takes DatabaseLike, no unknown/as-never casts at call sites); not
// separately re-tested to avoid fabricating a non-existent requirement
// (AGENTS.md: no extrapolation).

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike (same
// pattern as m1-s06-effective-entity-read.test.ts).
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

describe('M14-S04 event entity model (replaces the events table)', () => {
  describe('createEventEntity writes a base_entities row with type=Event', () => {
    it('a negative start_day is written and read back unchanged', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'The Long Winter Begins', start_day: -30, event_kind: 'single' });
        const row = db.prepare('SELECT type, title FROM base_entities WHERE id = ?').get(id) as { type: string; title: string };
        expect(row.type).toBe('Event');
        expect(row.title).toBe('The Long Winter Begins');
        const event = await getEventEntity(asyncDb, id);
        expect(event?.start_day).toBe(-30);
      } finally {
        db.close();
      }
    });

    it('a "phase" event with end_day >= start_day round-trips both values', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Siege of Karn', start_day: 100, end_day: 130, event_kind: 'phase' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.event_kind).toBe('phase');
        expect(event?.start_day).toBe(100);
        expect(event?.end_day).toBe(130);
      } finally {
        db.close();
      }
    });

    it('a "single" event has no end_day', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Signing of the Treaty', start_day: 50, event_kind: 'single' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.event_kind).toBe('single');
        expect(event?.end_day).toBeUndefined();
      } finally {
        db.close();
      }
    });

    it('properties_json carries event_kind/start_day/end_day/effects', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Founding Day', start_day: 0, event_kind: 'single' });
        const row = db.prepare('SELECT properties_json FROM base_entities WHERE id = ?').get(id) as { properties_json: string };
        const properties = JSON.parse(row.properties_json);
        expect(properties).toMatchObject({ event_kind: 'single', start_day: 0, effects: [] });
      } finally {
        db.close();
      }
    });
  });

  describe('listEventEntities reads from properties, not dedicated columns', () => {
    it('lists all Event entities with start_day/end_day/event_kind from properties', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, listEventEntities } = await getEventEntityService();
      try {
        await createEventEntity(asyncDb, { title: 'A', start_day: 10, event_kind: 'single' });
        await createEventEntity(asyncDb, { title: 'B', start_day: 20, end_day: 25, event_kind: 'phase' });
        const events = await listEventEntities(asyncDb);
        expect(events).toHaveLength(2);
        expect(events.find((e) => e.title === 'B')).toMatchObject({ start_day: 20, end_day: 25, event_kind: 'phase' });
      } finally {
        db.close();
      }
    });

    it('only returns base_entities rows with type=Event', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, listEventEntities } = await getEventEntityService();
      try {
        await createEventEntity(asyncDb, { title: 'Real Event', start_day: 1, event_kind: 'single' });
        db.prepare(
          `INSERT INTO base_entities (id, type, title, summary, properties_json, aliases_json, body_json, visibility, created_at, updated_at)
           VALUES (?, ?, ?, '', '{}', '[]', '{"format":"portable_blocks_v1","blocks":[]}', 'public', ?, ?)`,
        ).run('char-1', 'Character', 'Not An Event', new Date().toISOString(), new Date().toISOString());
        const events = await listEventEntities(asyncDb);
        expect(events.map((e) => e.title)).toEqual(['Real Event']);
      } finally {
        db.close();
      }
    });
  });

  describe('updateEventEntity patches properties', () => {
    it('updating start_day changes the read-back value', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, updateEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Moveable Feast', start_day: 5, event_kind: 'single' });
        await updateEventEntity(asyncDb, id, { start_day: 8 });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.start_day).toBe(8);
      } finally {
        db.close();
      }
    });
  });

  describe('no reference to the removed events table', () => {
    it('event-entity-service.ts does not reference an "events" table', () => {
      const src = readFileSync('src/services/event-entity-service.ts', 'utf-8');
      expect(src).not.toMatch(/\bFROM\s+events\b/i);
      expect(src).not.toMatch(/\bINTO\s+events\b/i);
    });
  });
});
