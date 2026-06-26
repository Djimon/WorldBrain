// @vitest-environment node
// M5-S03: Event schema & service layer — typed events, participants, locations, variable triggers.
// See: https://github.com/Djimon/WorldBrain/issues/69

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function openDb() {
  const { applyCalendarSchema } = await import('../core_data/calendar-schema');
  const { applyEventSchema } = await import('../core_data/event-schema');
  const db = new DatabaseSync(':memory:');
  applyCalendarSchema(db);
  applyEventSchema(db);
  return db;
}
async function getService() { return import('../src/services/event-service'); }

describe('M5-S03 event schema & service', () => {
  describe('schema', () => {
    it('creates events table', async () => {
      const db = await openDb();
      const cols = db.prepare('PRAGMA table_info(events)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('events table has required columns', async () => {
      const db = await openDb();
      const names = (db.prepare('PRAGMA table_info(events)').all() as Array<{ name: string }>).map(c => c.name);
      ['id','title','type','start_day','precision','visibility'].forEach(c => expect(names).toContain(c));
    });

    it('events table has participants_json, locations_json, variable_triggers_json', async () => {
      const db = await openDb();
      const names = (db.prepare('PRAGMA table_info(events)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names.some(n => n.includes('participant'))).toBe(true);
      expect(names.some(n => n.includes('location'))).toBe(true);
    });
  });

  describe('createEvent', () => {
    it('creates an event record', async () => {
      const { createEvent } = await getService();
      const db = await openDb();
      createEvent(db, { title: 'Battle of Iron Keep', type: 'historical_event', start_day: 1000, precision: 'day', visibility: 'public', participants: [], locations: [] });
      const rows = db.prepare('SELECT * FROM events').all() as unknown[];
      expect(rows.length).toBe(1);
    });

    it('returns the created event id', async () => {
      const { createEvent } = await getService();
      const db = await openDb();
      const result = createEvent(db, { title: 'Rumor', type: 'rumor', start_day: 500, precision: 'month', visibility: 'gm_only', participants: [], locations: [] });
      expect(typeof result.id).toBe('string');
      expect(result.id.length).toBeGreaterThan(0);
    });

    it('stores multiple participants', async () => {
      const { createEvent, getEvent } = await getService();
      const db = await openDb();
      const { id } = createEvent(db, { title: 'Council', type: 'session_event', start_day: 200, precision: 'day', visibility: 'public', participants: ['char-ada', 'char-bram'], locations: [] });
      const event = getEvent(db, id);
      expect(event?.participants).toContain('char-ada');
      expect(event?.participants).toContain('char-bram');
    });

    it('stores multiple locations', async () => {
      const { createEvent, getEvent } = await getService();
      const db = await openDb();
      const { id } = createEvent(db, { title: 'Raid', type: 'historical_event', start_day: 300, precision: 'day', visibility: 'public', participants: [], locations: ['loc-keep', 'loc-town'] });
      const event = getEvent(db, id);
      expect(event?.locations).toContain('loc-keep');
    });
  });

  describe('listEvents', () => {
    it('returns events sorted by start_day ascending', async () => {
      const { createEvent, listEvents } = await getService();
      const db = await openDb();
      createEvent(db, { title: 'Late', type: 'historical_event', start_day: 900, precision: 'day', visibility: 'public', participants: [], locations: [] });
      createEvent(db, { title: 'Early', type: 'historical_event', start_day: 100, precision: 'day', visibility: 'public', participants: [], locations: [] });
      const events = listEvents(db, {});
      expect(events[0].title).toBe('Early');
    });

    it('filters by event type', async () => {
      const { createEvent, listEvents } = await getService();
      const db = await openDb();
      createEvent(db, { title: 'History', type: 'historical_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: [] });
      createEvent(db, { title: 'Rumor', type: 'rumor', start_day: 2, precision: 'day', visibility: 'public', participants: [], locations: [] });
      const events = listEvents(db, { type: 'rumor' });
      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Rumor');
    });

    it('filters by participant entity_id', async () => {
      const { createEvent, listEvents } = await getService();
      const db = await openDb();
      createEvent(db, { title: 'Ada Event', type: 'session_event', start_day: 10, precision: 'day', visibility: 'public', participants: ['char-ada'], locations: [] });
      createEvent(db, { title: 'Other', type: 'session_event', start_day: 11, precision: 'day', visibility: 'public', participants: ['char-bram'], locations: [] });
      const events = listEvents(db, { participantId: 'char-ada' });
      expect(events.length).toBe(1);
      expect(events[0].title).toBe('Ada Event');
    });
  });

  describe('event types', () => {
    it('supports historical_event, session_event, rumor, prophecy', async () => {
      const { createEvent } = await getService();
      const db = await openDb();
      const types = ['historical_event', 'session_event', 'rumor', 'prophecy'];
      types.forEach((type, i) => {
        expect(() => createEvent(db, { title: `T${i}`, type, start_day: i, precision: 'day', visibility: 'public', participants: [], locations: [] })).not.toThrow();
      });
    });
  });

  describe('precision field', () => {
    it('accepts day, month, year, vague precision', async () => {
      const { createEvent } = await getService();
      const db = await openDb();
      ['day', 'month', 'year', 'vague'].forEach((precision, i) => {
        expect(() => createEvent(db, { title: `P${i}`, type: 'historical_event', start_day: i * 100, precision, visibility: 'public', participants: [], locations: [] })).not.toThrow();
      });
    });
  });
});

// Bug #105
describe('issue-105 listEvents SQL filter', () => {
  it('listEvents with participantId uses SQL WHERE, not in-memory filter', async () => {
    const { createEvent, listEvents } = await getService();
    const db = await openDb();

    createEvent(db, { title: 'Battle', type: 'session_event', start_day: 1, precision: 'day', visibility: 'public', participants: ['char-ada'], locations: [] });
    createEvent(db, { title: 'Peace Treaty', type: 'historical_event', start_day: 2, precision: 'day', visibility: 'public', participants: ['char-bob'], locations: [] });

    const result = listEvents(db, { participantId: 'char-ada' });
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Battle');
  });

  it('listEvents with locationId uses SQL WHERE, not in-memory filter', async () => {
    const { createEvent, listEvents } = await getService();
    const db = await openDb();

    createEvent(db, { title: 'Market', type: 'session_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: ['loc-market'] });
    createEvent(db, { title: 'Castle', type: 'session_event', start_day: 2, precision: 'day', visibility: 'public', participants: [], locations: ['loc-castle'] });

    const result = listEvents(db, { locationId: 'loc-market' });
    expect(result.length).toBe(1);
    expect(result[0].title).toBe('Market');
  });

  it('source does not do .filter() after SELECT * FROM', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/services/event-service.ts', 'utf8');
    // Should not have SELECT * followed by in-memory .filter()
    expect(src).not.toMatch(/SELECT \* FROM[^;]{0,200}\.filter\s*\(/s);
  });

  it('source uses SQL LIKE or JSON_EACH or sub-select for participant filter', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync('src/services/event-service.ts', 'utf8');
    expect(src).toMatch(/LIKE|json_each|JSON_EACH|WHERE.*participant|json_extract/i);
  });
});


// Bug #127: updateEvent only patches title+type — all other AC fields silently ignored
describe('issue #127: updateEvent patches all fields', () => {
  it('updateEvent persists start_day changes', async () => {
    const { createEvent, updateEvent, listEvents } = await getService();
    const db = await openDb();
    createEvent(db, { title: 'Siege', type: 'historical_event', start_day: 10, precision: 'day', visibility: 'public', participants: [], locations: [] });
    const id = (listEvents(db, {}) as Array<{ id: string }>)[0].id;
    updateEvent(db, id, { start_day: 99 });
    const updated = (listEvents(db, {}) as Array<{ start_day: number }>)[0];
    expect(updated.start_day).toBe(99);
  });

  it('updateEvent persists end_day changes', async () => {
    const { createEvent, updateEvent, listEvents } = await getService();
    const db = await openDb();
    createEvent(db, { title: 'Siege', type: 'historical_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: [] });
    const id = (listEvents(db, {}) as Array<{ id: string }>)[0].id;
    updateEvent(db, id, { end_day: 5 });
    const updated = (listEvents(db, {}) as Array<{ end_day: number | null }>)[0];
    expect(updated.end_day).toBe(5);
  });

  it('updateEvent persists visibility changes', async () => {
    const { createEvent, updateEvent, listEvents } = await getService();
    const db = await openDb();
    createEvent(db, { title: 'Secret Meeting', type: 'session_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: [] });
    const id = (listEvents(db, {}) as Array<{ id: string }>)[0].id;
    updateEvent(db, id, { visibility: 'gm_only' });
    const updated = (listEvents(db, {}) as Array<{ visibility: string }>)[0];
    expect(updated.visibility).toBe('gm_only');
  });

  it('updateEvent persists participants changes', async () => {
    const { createEvent, updateEvent, listEvents } = await getService();
    const db = await openDb();
    createEvent(db, { title: 'Council', type: 'session_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: [] });
    const id = (listEvents(db, {}) as Array<{ id: string }>)[0].id;
    updateEvent(db, id, { participants: ['char-ada', 'char-bram'] });
    const updated = (listEvents(db, {}) as Array<{ participants: string[] }>)[0];
    expect(updated.participants).toEqual(['char-ada', 'char-bram']);
  });

  it('updateEvent persists locations changes', async () => {
    const { createEvent, updateEvent, listEvents } = await getService();
    const db = await openDb();
    createEvent(db, { title: 'Raid', type: 'session_event', start_day: 1, precision: 'day', visibility: 'public', participants: [], locations: [] });
    const id = (listEvents(db, {}) as Array<{ id: string }>)[0].id;
    updateEvent(db, id, { locations: ['loc-keep'] });
    const updated = (listEvents(db, {}) as Array<{ locations: string[] }>)[0];
    expect(updated.locations).toEqual(['loc-keep']);
  });
});
