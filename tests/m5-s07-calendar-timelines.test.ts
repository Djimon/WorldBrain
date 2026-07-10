// @vitest-environment node
// Calendar Timelines epic (planning/epics/calendar-timelines-eras.md):
// S4 active-calendar selection + S3 era CRUD service layer.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyCalendarSchema } from '../core_data/calendar-schema';
import { saveCalendar, listCalendars, setActiveCalendar, getActiveCalendarId } from '../src/services/calendar-service';
import { listEras, saveEra, deleteEra } from '../src/services/era-service';

// Async DatabaseLike wrapper around the sync in-memory node:sqlite handle.
function makeDb() {
  const raw = new DatabaseSync(':memory:');
  applyCalendarSchema(raw);
  return {
    execute: async (sql: string, args: unknown[] = []) => { raw.prepare(sql).run(...(args as never[])); },
    select: async <T = Record<string, unknown>>(sql: string, args: unknown[] = []): Promise<T[]> =>
      raw.prepare(sql).all(...(args as never[])) as T[],
  };
}

const cal = (title: string) => ({ title, yearLengthDays: 360, months: [{ name: 'M', days: 360 }], week: ['A'] });

describe('S4 active display calendar', () => {
  it('setActiveCalendar marks exactly one calendar active', async () => {
    const db = makeDb();
    const a = await saveCalendar(db, cal('A'));
    const b = await saveCalendar(db, cal('B'));

    await setActiveCalendar(db, a);
    expect(await getActiveCalendarId(db)).toBe(a);

    await setActiveCalendar(db, b);
    expect(await getActiveCalendarId(db)).toBe(b);

    const active = (await listCalendars(db)).filter((c) => c.is_active);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe(b);
  });

  it('switching the active calendar does not touch any events row', async () => {
    const db = makeDb();
    await db.execute(`CREATE TABLE events (id TEXT PRIMARY KEY, start_day INTEGER)`);
    await db.execute(`INSERT INTO events (id, start_day) VALUES ('e1', 42)`);
    const a = await saveCalendar(db, cal('A'));
    const b = await saveCalendar(db, cal('B'));

    await setActiveCalendar(db, a);
    await setActiveCalendar(db, b);

    const rows = await db.select<{ id: string; start_day: number }>('SELECT id, start_day FROM events');
    expect(rows).toEqual([{ id: 'e1', start_day: 42 }]); // untouched by calendar switching
  });
});

describe('S3 era CRUD service', () => {
  it('save / list / delete eras for a calendar', async () => {
    const db = makeDb();
    const c = await saveCalendar(db, cal('C'));
    await saveEra(db, { calendar_id: c, name: 'Ära der Grah', start_year: 1 });
    await saveEra(db, { calendar_id: c, name: 'Furchung', start_year: 401 });

    let eras = await listEras(db, c);
    expect(eras.map((e) => e.name)).toEqual(['Ära der Grah', 'Furchung']); // ordered by start_year

    await deleteEra(db, eras[0].id);
    eras = await listEras(db, c);
    expect(eras.map((e) => e.name)).toEqual(['Furchung']);
  });
});
