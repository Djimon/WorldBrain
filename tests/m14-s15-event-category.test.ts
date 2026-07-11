// @vitest-environment node
// M14-S15: Event-Kategorie (thematisch, erweiterbar)
// See: https://github.com/Djimon/WorldBrain/issues/272
//
// Note: pure DatabaseLike service module (no UI component in this story's
// Unit-Tests bullet) — the generic AP-001 "database prop typed as
// DatabaseLike" requirement is satisfied structurally (every function takes
// DatabaseLike, no unknown/as-never casts at call sites); not separately
// re-tested to avoid fabricating a non-existent requirement (AGENTS.md: no
// extrapolation). The Event-Formular category field (M14-S07, #262,
// status: blocked) is out of scope here — this file covers only the service
// layer this story's AC actually requires.

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';

// Unavoidable scaffolding: wraps DatabaseSync as async DatabaseLike (same
// pattern as m1-s06-effective-entity-read.test.ts / m14-s04-event-entity).
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

describe('M14-S15 event category (thematic, optional, extensible)', () => {
  describe('category round-trips through properties', () => {
    it('creating an event with category="battle" reads back category="battle"', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Siege of Karn', start_day: 100, event_kind: 'single', category: 'battle' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.category).toBe('battle');
      } finally {
        db.close();
      }
    });

    it('creating an event without a category reads back category=undefined (uncategorized)', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Unremarkable Tuesday', start_day: 5, event_kind: 'single' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.category).toBeUndefined();
      } finally {
        db.close();
      }
    });

    it('a free-text (non-seed) category is accepted — no DB enum constraint', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'DM Invented Category', start_day: 1, event_kind: 'single', category: 'a_totally_custom_category' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.category).toBe('a_totally_custom_category');
      } finally {
        db.close();
      }
    });

    it('listEventEntities also carries category through', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, listEventEntities } = await getEventEntityService();
      try {
        await createEventEntity(asyncDb, { title: 'Ritual at Dawn', start_day: 10, event_kind: 'single', category: 'ritual' });
        const events = await listEventEntities(asyncDb);
        expect(events.find((e) => e.title === 'Ritual at Dawn')?.category).toBe('ritual');
      } finally {
        db.close();
      }
    });

    it('updateEventEntity can set a category on an existing uncategorized event', async () => {
      const { db, asyncDb } = createDatabase();
      const { createEventEntity, updateEventEntity, getEventEntity } = await getEventEntityService();
      try {
        const { id } = await createEventEntity(asyncDb, { title: 'Undetermined Incident', start_day: 3, event_kind: 'single' });
        await updateEventEntity(asyncDb, id, { category: 'disaster' });
        const event = await getEventEntity(asyncDb, id);
        expect(event?.category).toBe('disaster');
      } finally {
        db.close();
      }
    });
  });

  describe('EVENT_CATEGORY_SUGGESTIONS: 8 seed values, DM-extensible', () => {
    it('exports exactly 8 seed category suggestions', async () => {
      const { EVENT_CATEGORY_SUGGESTIONS } = await getEventEntityService();
      expect(EVENT_CATEGORY_SUGGESTIONS.length).toBe(8);
    });

    it('the seed suggestions match the AC list', async () => {
      const { EVENT_CATEGORY_SUGGESTIONS } = await getEventEntityService();
      expect([...EVENT_CATEGORY_SUGGESTIONS].sort()).toEqual(
        ['battle', 'death', 'disaster', 'discovery', 'investigation', 'politics', 'ritual', 'social'],
      );
    });
  });
});
