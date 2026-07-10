// @vitest-environment node
// Calendar Timelines epic (planning/epics/calendar-timelines-eras.md):
// S4 active-calendar selection + S3 era CRUD service layer.
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { applyCalendarSchema } from '../core_data/calendar-schema';
import { saveCalendar, listCalendars, setActiveCalendar, getActiveCalendarId, updateCalendarAnchor, deleteCalendar } from '../src/services/calendar-service';
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

describe('editing preserves anchor + active flag (UPDATE, not REPLACE)', () => {
  it('editing a calendar keeps epoch_anchor_day / is_active and saves the start date', async () => {
    const db = makeDb();
    const a = await saveCalendar(db, cal('A'));
    await setActiveCalendar(db, a);
    await updateCalendarAnchor(db, a, -999);

    // re-save the same calendar (edit): must not reset the unlisted columns
    await saveCalendar(db, { ...cal('A renamed'), start: { year: 400, month: 4, day: 5 } }, a);

    const rows = await db.select<{ title: string; epoch_anchor_day: number; is_active: number; start_year: number; start_month: number; start_day: number }>(
      'SELECT title, epoch_anchor_day, is_active, start_year, start_month, start_day FROM calendars WHERE id = ?', [a]);
    expect(rows[0].title).toBe('A renamed');
    expect(rows[0].epoch_anchor_day).toBe(-999); // preserved
    expect(rows[0].is_active).toBe(1);            // preserved
    expect([rows[0].start_year, rows[0].start_month, rows[0].start_day]).toEqual([400, 4, 5]);
  });
});

describe('S5 cross-calendar link persistence', () => {
  it('updateCalendarAnchor persists the epoch anchor (only that calendar)', async () => {
    const db = makeDb();
    const a = await saveCalendar(db, cal('A'));
    const b = await saveCalendar(db, cal('B'));
    await updateCalendarAnchor(db, b, -2243829);
    const rowB = await db.select<{ epoch_anchor_day: number }>('SELECT epoch_anchor_day FROM calendars WHERE id = ?', [b]);
    const rowA = await db.select<{ epoch_anchor_day: number }>('SELECT epoch_anchor_day FROM calendars WHERE id = ?', [a]);
    expect(rowB[0].epoch_anchor_day).toBe(-2243829);
    expect(rowA[0].epoch_anchor_day).toBe(0); // reference calendar untouched
  });
});

describe('delete calendar', () => {
  it('deleteCalendar removes the calendar and its eras, leaves others', async () => {
    const db = makeDb();
    const a = await saveCalendar(db, cal('A'));
    const b = await saveCalendar(db, cal('B'));
    await saveEra(db, { calendar_id: a, name: 'X', start_year: 1, start_month: 1, start_day: 1, end_year: 1, end_month: 1, end_day: 1 });

    await deleteCalendar(db, a);

    const remaining = (await listCalendars(db)).map((c) => c.id);
    expect(remaining).toEqual([b]);
    expect(await listEras(db, a)).toEqual([]); // eras gone too
  });
});

describe('S3 era CRUD service', () => {
  it('save / list / delete eras for a calendar', async () => {
    const db = makeDb();
    const c = await saveCalendar(db, cal('C'));
    await saveEra(db, { calendar_id: c, name: 'Ära der Grah', start_year: 1, start_month: 1, start_day: 1, end_year: 400, end_month: 12, end_day: 30 });
    await saveEra(db, { calendar_id: c, name: 'Furchung', start_year: 401, start_month: 1, start_day: 1, end_year: 1200, end_month: 12, end_day: 30 });

    let eras = await listEras(db, c);
    expect(eras.map((e) => e.name)).toEqual(['Ära der Grah', 'Furchung']); // ordered by start_year

    await deleteEra(db, eras[0].id);
    eras = await listEras(db, c);
    expect(eras.map((e) => e.name)).toEqual(['Furchung']);
  });
});
