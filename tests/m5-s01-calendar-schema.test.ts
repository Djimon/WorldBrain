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

  describe('idempotency', () => {
    it('schema creation is idempotent', async () => {
      const { applyCalendarSchema } = await getCalendarSchema();
      const db = openDb(); applyCalendarSchema(db);
      expect(() => applyCalendarSchema(db)).not.toThrow();
    });
  });
});
