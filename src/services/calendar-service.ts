import type { DatabaseLike } from './entity-service';

export interface CalendarData {
  title: string;
  yearLengthDays: number;
  months: { name: string; days: number }[];
  week: string[];
}

export async function saveCalendar(db: DatabaseLike, data: CalendarData): Promise<string> {
  const id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute(
    `INSERT OR REPLACE INTO calendars (id, title, year_length_days, months_json, week_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.yearLengthDays, JSON.stringify(data.months), JSON.stringify(data.week), now, now],
  );
  return id;
}

export async function listCalendars(db: DatabaseLike): Promise<{ id: string; title: string }[]> {
  return db.select<{ id: string; title: string }>('SELECT id, title FROM calendars ORDER BY created_at');
}

export function importCalendarFromJson(json: string): unknown {
  return JSON.parse(json);
}

export function formatAbsoluteDay(day: number): string {
  return `Day ${day}`;
}
