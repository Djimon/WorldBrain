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
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS eras (
      id TEXT PRIMARY KEY NOT NULL,
      calendar_id TEXT NOT NULL,
      starts_absolute_day INTEGER NOT NULL DEFAULT 0,
      year_number_at_start INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

export function dayToDate(calendar: { year_length_days: number }, absoluteDay: number): CalendarDate {
  const yl = calendar.year_length_days;
  const year = Math.floor(absoluteDay / yl) + 1;
  const day = (absoluteDay % yl) + 1;
  return { year, month: 1, day };
}

export function dateToDay(calendar: { year_length_days: number }, date: CalendarDate): number {
  return (date.year - 1) * calendar.year_length_days + (date.day - 1);
}
