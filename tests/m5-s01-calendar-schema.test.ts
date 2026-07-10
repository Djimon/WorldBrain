// @vitest-environment node
// M5-S01: Calendar data model & presets — schema, presets, day conversion functions.
// See: https://github.com/Djimon/WorldBrain/issues/67

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

async function getCalendarSchema() { return import('../core_data/calendar-schema'); }
function openDb() { return new DatabaseSync(':memory:'); }

describe('M5-S01 calendar schema', () => {
  describe('calendars table', () => {
    it('creates calendars table', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      const cols = db.prepare('PRAGMA table_info(calendars)').all() as Array<{ name: string }>;
      expect(cols.length).toBeGreaterThan(0);
    });

    it('calendars has id, title, year_length_days, months_json, week_json, epoch_label', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      const names = (db.prepare('PRAGMA table_info(calendars)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('title');
      expect(names).toContain('year_length_days');
      expect(names).toContain('epoch_label');
    });
  });

  describe('eras table', () => {
    it('creates eras table with calendar_id, starts_absolute_day, year_number_at_start', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      const names = (db.prepare('PRAGMA table_info(eras)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('id');
      expect(names).toContain('calendar_id');
      expect(names).toContain('starts_absolute_day');
      expect(names).toContain('year_number_at_start');
    });
  });

  describe('built-in presets', () => {
    it('exports 3 built-in presets', async () => {
      const mod = await getCalendarSchema();
      const presets = (mod as Record<string, unknown>).CALENDAR_PRESETS as unknown[];
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBe(3);
    });

    it('Earth-like preset has 365 days and 12 months', async () => {
      const { CALENDAR_PRESETS } = await getCalendarSchema() as Record<string, unknown[]>;
      const earth = (CALENDAR_PRESETS as Array<Record<string, unknown>>).find(p => p.id === 'earth_like' || (p.year_length_days as number) === 365);
      expect(earth).toBeDefined();
      expect(earth!.year_length_days).toBe(365);
    });

    it('Simple Fantasy preset has 360 days', async () => {
      const { CALENDAR_PRESETS } = await getCalendarSchema() as Record<string, unknown[]>;
      const fantasy = (CALENDAR_PRESETS as Array<Record<string, unknown>>).find(p => (p.year_length_days as number) === 360);
      expect(fantasy).toBeDefined();
    });

    it('Blank/Custom preset exists', async () => {
      const { CALENDAR_PRESETS } = await getCalendarSchema() as Record<string, unknown[]>;
      const blank = (CALENDAR_PRESETS as Array<Record<string, unknown>>).find(p => /blank|custom/i.test(String(p.id ?? p.title)));
      expect(blank).toBeDefined();
    });
  });

  describe('day conversion functions', () => {
    it('exports dayToDate and dateToDay functions', async () => {
      const mod = await getCalendarSchema();
      expect(typeof (mod as Record<string, unknown>).dayToDate).toBe('function');
      expect(typeof (mod as Record<string, unknown>).dateToDay).toBe('function');
    });

    it('dayToDate and dateToDay are inverse operations', async () => {
      const { dayToDate, dateToDay, CALENDAR_PRESETS } = await getCalendarSchema() as Record<string, unknown>;
      const calendar = (CALENDAR_PRESETS as Array<Record<string, unknown>>)[0];
      const absoluteDay = 400;
      const date = (dayToDate as (c: unknown, d: number) => unknown)(calendar, absoluteDay);
      const roundTripped = (dateToDay as (c: unknown, d: unknown) => number)(calendar, date);
      expect(roundTripped).toBe(absoluteDay);
    });
  });

  describe('projection: month derivation + signed counter (S1 #251)', () => {
    it('calendars table has epoch_anchor_day column', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      const names = (db.prepare('PRAGMA table_info(calendars)').all() as Array<{ name: string }>).map(c => c.name);
      expect(names).toContain('epoch_anchor_day');
    });

    it('derives month + day from months (fantasy 12x30)', async () => {
      const { dayToDate, CALENDAR_PRESETS } = await getCalendarSchema();
      const cal = CALENDAR_PRESETS[1]; // 360d, 12x30
      expect(dayToDate(cal, 0)).toEqual({ year: 1, month: 1, day: 1 });
      expect(dayToDate(cal, 30)).toEqual({ year: 1, month: 2, day: 1 });
      expect(dayToDate(cal, 59)).toEqual({ year: 1, month: 2, day: 30 });
      expect(dayToDate(cal, 360)).toEqual({ year: 2, month: 1, day: 1 });
    });

    it('derives month across irregular month lengths (earth-like)', async () => {
      const { dayToDate, CALENDAR_PRESETS } = await getCalendarSchema();
      const cal = CALENDAR_PRESETS[0]; // 365d, Jan31 Feb28 Mar31...
      expect(dayToDate(cal, 31)).toEqual({ year: 1, month: 2, day: 1 });   // Feb 1
      expect(dayToDate(cal, 58)).toEqual({ year: 1, month: 2, day: 28 });  // Feb 28
      expect(dayToDate(cal, 59)).toEqual({ year: 1, month: 3, day: 1 });   // Mar 1
    });

    it('projects negative (pre-epoch) days into earlier years', async () => {
      const { dayToDate, CALENDAR_PRESETS } = await getCalendarSchema();
      const cal = CALENDAR_PRESETS[1];
      expect(dayToDate(cal, -1)).toEqual({ year: 0, month: 12, day: 30 });
      expect(dayToDate(cal, -360)).toEqual({ year: 0, month: 1, day: 1 });
      expect(dayToDate(cal, -361)).toEqual({ year: -1, month: 12, day: 30 });
    });

    it('dayToDate/dateToDay round-trip for positive and negative days', async () => {
      const { dayToDate, dateToDay, CALENDAR_PRESETS } = await getCalendarSchema();
      const cal = CALENDAR_PRESETS[0];
      for (const d of [-800, -365, -1, 0, 1, 59, 365, 1234]) {
        expect(dateToDay(cal, dayToDate(cal, d))).toBe(d);
      }
    });

    it('counterToDate applies epoch_anchor_day and round-trips (both directions)', async () => {
      const { counterToDate, dateToCounter, CALENDAR_PRESETS } = await getCalendarSchema();
      const cal = { ...CALENDAR_PRESETS[1], epoch_anchor_day: 100 };
      expect(counterToDate(cal, 100)).toEqual({ year: 1, month: 1, day: 1 });
      expect(counterToDate(cal, 99)).toEqual({ year: 0, month: 12, day: 30 });
      for (const d of [-50, 0, 100, 500]) {
        expect(dateToCounter(cal, counterToDate(cal, d))).toBe(d);
      }
    });
  });

  describe('eras: explicit start/end ranges, overlaps + gaps allowed', () => {
    // "Ära der Grah" 1.1.1 – 30.12.400 and "Furchung" 1.1.350 – 30.12.1200
    // deliberately OVERLAP between years 350 and 400.
    const grah = { name: 'Ära der Grah', start_year: 1, start_month: 1, start_day: 1, end_year: 400, end_month: 12, end_day: 30 };
    const furchung = { name: 'Furchung', start_year: 350, start_month: 1, start_day: 1, end_year: 1200, end_month: 12, end_day: 30 };
    const eras = [furchung, grah]; // deliberately unsorted

    it('eras table has explicit start/end date columns', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      const names = (db.prepare('PRAGMA table_info(eras)').all() as Array<{ name: string }>).map(c => c.name);
      for (const col of ['name', 'start_year', 'start_month', 'start_day', 'end_year', 'end_month', 'end_day']) {
        expect(names).toContain(col);
      }
    });

    it('erasForDate returns the single covering era', async () => {
      const { erasForDate } = await getCalendarSchema();
      expect(erasForDate(eras, { year: 100, month: 1, day: 1 }).map((e) => e.name)).toEqual(['Ära der Grah']);
      expect(erasForDate(eras, { year: 900, month: 1, day: 1 }).map((e) => e.name)).toEqual(['Furchung']);
    });

    it('overlapping eras are ALL returned, sorted by start date', async () => {
      const { erasForDate } = await getCalendarSchema();
      expect(erasForDate(eras, { year: 380, month: 5, day: 3 }).map((e) => e.name))
        .toEqual(['Ära der Grah', 'Furchung']);
    });

    it('a date outside every era (gap / before / after) returns none', async () => {
      const { erasForDate } = await getCalendarSchema();
      const gapped = [
        { name: 'A', start_year: 1, start_month: 1, start_day: 1, end_year: 100, end_month: 1, end_day: 1 },
        { name: 'B', start_year: 200, start_month: 1, start_day: 1, end_year: 300, end_month: 1, end_day: 1 },
      ];
      expect(erasForDate(gapped, { year: 150, month: 1, day: 1 })).toEqual([]); // gap
      expect(erasForDate(eras, { year: 1500, month: 1, day: 1 })).toEqual([]);  // after the last
    });

    it('era boundaries are inclusive (start and end day count)', async () => {
      const { erasForDate } = await getCalendarSchema();
      expect(erasForDate([grah], { year: 1, month: 1, day: 1 }).map((e) => e.name)).toEqual(['Ära der Grah']);
      expect(erasForDate([grah], { year: 400, month: 12, day: 30 }).map((e) => e.name)).toEqual(['Ära der Grah']);
      expect(erasForDate([grah], { year: 401, month: 1, day: 1 })).toEqual([]);
    });

    it('erasForRange returns every era overlapping a displayed month', async () => {
      const { erasForRange } = await getCalendarSchema();
      // month spanning the overlap
      expect(erasForRange(eras, { year: 380, month: 1, day: 1 }, { year: 380, month: 1, day: 30 }).map((e) => e.name))
        .toEqual(['Ära der Grah', 'Furchung']);
    });

    it('eraRelativeYear renumbers within a given era', async () => {
      const { eraRelativeYear } = await getCalendarSchema();
      expect(eraRelativeYear({ ...furchung, year_number_at_start: 1 }, 350)).toBe(1);
      expect(eraRelativeYear({ ...furchung, year_number_at_start: 1 }, 354)).toBe(5);
    });
  });

  describe('cross-calendar conversion (S5 #255)', () => {
    it('one equivalence links two calendars and converts both directions', async () => {
      const { convertDate, anchorForEquivalence } = await getCalendarSchema();
      const A = { year_length_days: 360, months: [{ name: 'M', days: 360 }], epoch_anchor_day: 0 };
      const B = { year_length_days: 365, months: [{ name: 'M', days: 365 }], epoch_anchor_day: 0 };
      const dateA = { year: 400, month: 1, day: 1 };
      const dateB = { year: 6542, month: 1, day: 5 };
      const linkedB = { ...B, epoch_anchor_day: anchorForEquivalence(A, dateA, B, dateB) };
      expect(convertDate(A, dateA, linkedB)).toEqual(dateB); // A → B
      expect(convertDate(linkedB, dateB, A)).toEqual(dateA); // B → A (bidirectional)

      // the constant offset holds for any other date, both ways
      const other = { year: 401, month: 1, day: 1 };
      const conv = convertDate(A, other, linkedB);
      expect(convertDate(linkedB, conv, A)).toEqual(other);
    });
  });

  describe('idempotency', () => {
    it('schema creation is idempotent', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      expect(() => applyCalendarSchema(db)).not.toThrow();
    });
  });
});
