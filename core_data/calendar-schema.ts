import { DatabaseSync } from 'node:sqlite';

type CalendarDb = InstanceType<typeof DatabaseSync>;

export interface CalendarPreset {
  id: string;
  name: string;
  year_length_days: number;
  months: Array<{ name: string; days: number }>;
  week: string[];
}

export const CALENDAR_PRESETS: CalendarPreset[] = [
  {
    id: 'earth_like',
    name: 'Earth-like',
    year_length_days: 365,
    months: [
      { name: 'January', days: 31 }, { name: 'February', days: 28 },
      { name: 'March', days: 31 }, { name: 'April', days: 30 },
      { name: 'May', days: 31 }, { name: 'June', days: 30 },
      { name: 'July', days: 31 }, { name: 'August', days: 31 },
      { name: 'September', days: 30 }, { name: 'October', days: 31 },
      { name: 'November', days: 30 }, { name: 'December', days: 31 },
    ],
    week: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  },
  {
    id: 'fantasy',
    name: 'Simple Fantasy',
    year_length_days: 360,
    months: [
      { name: 'First Month', days: 30 }, { name: 'Second Month', days: 30 },
      { name: 'Third Month', days: 30 }, { name: 'Fourth Month', days: 30 },
      { name: 'Fifth Month', days: 30 }, { name: 'Sixth Month', days: 30 },
      { name: 'Seventh Month', days: 30 }, { name: 'Eighth Month', days: 30 },
      { name: 'Ninth Month', days: 30 }, { name: 'Tenth Month', days: 30 },
      { name: 'Eleventh Month', days: 30 }, { name: 'Twelfth Month', days: 30 },
    ],
    week: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
  },
  {
    id: 'blank_custom',
    name: 'Blank / Custom',
    year_length_days: 365,
    months: [],
    week: [],
  },
];

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export function applyCalendarSchema(db: CalendarDb): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS calendars (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      year_length_days INTEGER NOT NULL DEFAULT 365,
      epoch_label TEXT NOT NULL DEFAULT 'Year',
      months_json TEXT NOT NULL DEFAULT '[]',
      week_json TEXT NOT NULL DEFAULT '[]',
      epoch_anchor_day INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS eras (
      id TEXT PRIMARY KEY NOT NULL,
      calendar_id TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      start_year INTEGER NOT NULL DEFAULT 1,
      year_number_at_start INTEGER NOT NULL DEFAULT 1,
      starts_absolute_day INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

// A calendar is a PROJECTION over the shared internal absolute-day counter.
// `epoch_anchor_day` = the counter day this calendar treats as its origin
// (localDay 0 → year 1, month 1, day 1). The counter is a signed axis with no
// floor: past days are negative. See planning/epics/calendar-timelines-eras.md.
export interface CalendarShape {
  year_length_days: number;
  months?: Array<{ name: string; days: number }>;
  epoch_anchor_day?: number;
}

/** JS `%` takes the sign of the dividend; we need a true floored modulo so
 *  negative local days project correctly (day -1 → last day of previous year). */
function floorMod(a: number, n: number): number {
  return ((a % n) + n) % n;
}

function effectiveMonths(calendar: CalendarShape): Array<{ name: string; days: number }> {
  if (calendar.months && calendar.months.length > 0) return calendar.months;
  return [{ name: 'Year', days: calendar.year_length_days }];
}

// V1: every year has the same length (sum of months). Variable-length years
// (leap years, alternating lengths) are intentionally NOT modelled yet — but
// they stay a purely INTERNAL change to dayToDate/dateToDay (replace the
// constant year * yearLength math with a per-year accumulation) behind the
// same function signatures. No schema or caller change required. Do not bake
// the constant-length assumption into callers.
function yearLength(calendar: CalendarShape): number {
  const months = effectiveMonths(calendar);
  return months.reduce((sum, m) => sum + m.days, 0);
}

/** Project a calendar-local day (relative to the calendar's epoch, day 0 =
 *  year 1 / month 1 / day 1) to {year, month, day}. Correct for negative days. */
export function dayToDate(calendar: CalendarShape, localDay: number): CalendarDate {
  const yl = yearLength(calendar);
  if (yl <= 0) return { year: 1, month: 1, day: 1 };
  const year = Math.floor(localDay / yl) + 1;
  let dayOfYear = floorMod(localDay, yl);
  const months = effectiveMonths(calendar);
  for (let month = 1; month <= months.length; month++) {
    const len = months[month - 1].days;
    if (dayOfYear < len) return { year, month, day: dayOfYear + 1 };
    dayOfYear -= len;
  }
  const last = months.length;
  return { year, month: last, day: months[last - 1].days };
}

/** Inverse of dayToDate: {year, month, day} → calendar-local day. */
export function dateToDay(calendar: CalendarShape, date: CalendarDate): number {
  const yl = yearLength(calendar);
  const months = effectiveMonths(calendar);
  let dayOfYear = 0;
  for (let i = 0; i < date.month - 1 && i < months.length; i++) dayOfYear += months[i].days;
  dayOfYear += date.day - 1;
  return (date.year - 1) * yl + dayOfYear;
}

/** Project a shared-counter day to this calendar's date (applies the anchor). */
export function counterToDate(calendar: CalendarShape, counterDay: number): CalendarDate {
  return dayToDate(calendar, counterDay - (calendar.epoch_anchor_day ?? 0));
}

/** Inverse: this calendar's date → shared-counter day. */
export function dateToCounter(calendar: CalendarShape, date: CalendarDate): number {
  return dateToDay(calendar, date) + (calendar.epoch_anchor_day ?? 0);
}

// ── Eras (M13 calendar-timelines S3) ─────────────────────────────────────────
// An era is a named label over a contiguous range of GLOBAL years. Eras are
// stored by their start year; each era runs until the next era's start (the
// last era is open-ended). `year_number_at_start` supports era-relative
// renumbering ("Year 5 of the Furchung"); default 1.
export interface Era {
  id?: string;
  calendar_id?: string;
  name: string;
  start_year: number;
  year_number_at_start?: number;
}

/** The era covering a global year (the latest era whose start_year <= year), or null. */
export function eraForYear(eras: Era[], globalYear: number): Era | null {
  let found: Era | null = null;
  for (const e of [...eras].sort((a, b) => a.start_year - b.start_year)) {
    if (e.start_year <= globalYear) found = e; else break;
  }
  return found;
}

/** Era-relative year number for a global year within its era ("Year 5 of X"). */
export function eraRelativeYear(era: Era, globalYear: number): number {
  return globalYear - era.start_year + (era.year_number_at_start ?? 1);
}
