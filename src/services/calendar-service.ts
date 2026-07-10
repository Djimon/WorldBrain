import type { DatabaseLike } from './entity-service';

export interface CalendarData {
  title: string;
  yearLengthDays: number;
  months: { name: string; days: number }[];
  week: string[];
}

export async function saveCalendar(db: DatabaseLike, data: CalendarData, existingId?: string): Promise<string> {
  // Reuse the id when editing so the row is updated in place (INSERT OR
  // REPLACE) instead of creating a duplicate calendar.
  const id = existingId ?? `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute(
    `INSERT OR REPLACE INTO calendars (id, title, year_length_days, months_json, week_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.yearLengthDays, JSON.stringify(data.months), JSON.stringify(data.week), now],
  );
  return id;
}

export async function listCalendars(db: DatabaseLike): Promise<{ id: string; title: string; is_active: number }[]> {
  return db.select<{ id: string; title: string; is_active: number }>(
    'SELECT id, title, is_active FROM calendars ORDER BY created_at',
  );
}

/** Marks one calendar as the active display calendar (project-wide, one at a
 *  time). Events are unaffected — they stay pinned to the shared counter and
 *  are re-projected by whichever calendar is active. */
export async function setActiveCalendar(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('UPDATE calendars SET is_active = 0');
  await db.execute('UPDATE calendars SET is_active = 1 WHERE id = ?', [id]);
}

export async function getActiveCalendarId(db: DatabaseLike): Promise<string | null> {
  const rows = await db.select<{ id: string }>('SELECT id FROM calendars WHERE is_active = 1 LIMIT 1');
  return rows[0]?.id ?? null;
}

export function importCalendarFromJson(json: string): unknown {
  return JSON.parse(json);
}

export function formatAbsoluteDay(day: number): string {
  return `Day ${day}`;
}
