import type { DatabaseLike } from './entity-service';

export interface CalendarData {
  title: string;
  yearLengthDays: number;
  months: { name: string; days: number }[];
  week: string[];
  /** The calendar's start / reference date ("the world begins here"). */
  start?: { year: number; month: number; day: number };
}

export async function saveCalendar(db: DatabaseLike, data: CalendarData, existingId?: string): Promise<string> {
  const s = data.start ?? { year: 1, month: 1, day: 1 };
  if (existingId) {
    // UPDATE (not INSERT OR REPLACE) so editing keeps epoch_anchor_day and
    // is_active — a REPLACE would reset those unlisted columns to defaults.
    await db.execute(
      `UPDATE calendars SET title = ?, year_length_days = ?, months_json = ?, week_json = ?,
         start_year = ?, start_month = ?, start_day = ? WHERE id = ?`,
      [data.title, data.yearLengthDays, JSON.stringify(data.months), JSON.stringify(data.week),
       s.year, s.month, s.day, existingId],
    );
    return existingId;
  }
  const id = `cal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  await db.execute(
    `INSERT INTO calendars (id, title, year_length_days, months_json, week_json, start_year, start_month, start_day, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, data.title, data.yearLengthDays, JSON.stringify(data.months), JSON.stringify(data.week),
     s.year, s.month, s.day, now],
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

export interface CalendarRow {
  id: string;
  title: string;
  year_length_days: number;
  months: { name: string; days: number }[];
  week: string[];
  epoch_anchor_day: number;
  start_year: number;
  start_month: number;
  start_day: number;
}

export async function loadCalendarById(db: DatabaseLike, id: string): Promise<CalendarRow | null> {
  const rows = await db.select<{
    id: string; title: string; year_length_days: number; months_json: string; week_json: string;
    epoch_anchor_day: number; start_year: number; start_month: number; start_day: number;
  }>(
    'SELECT id, title, year_length_days, months_json, week_json, epoch_anchor_day, start_year, start_month, start_day FROM calendars WHERE id = ?',
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    year_length_days: row.year_length_days,
    months: JSON.parse(row.months_json ?? '[]') as { name: string; days: number }[],
    week: JSON.parse(row.week_json ?? '[]') as string[],
    epoch_anchor_day: row.epoch_anchor_day ?? 0,
    start_year: row.start_year ?? 1,
    start_month: row.start_month ?? 1,
    start_day: row.start_day ?? 1,
  };
}

/**
 * The project's active display calendar (one at a time, is_active flag) —
 * the same one CalendarMonthView shows. A day-counter is meaningless without
 * one; this lets any Event display resolve a real date even when it wasn't
 * explicitly handed a calendar (e.g. viewed via the Entity-Browser, not the
 * calendar area).
 */
export async function loadActiveCalendar(db: DatabaseLike): Promise<CalendarRow | null> {
  const activeId = await getActiveCalendarId(db);
  if (!activeId) return null;
  return loadCalendarById(db, activeId);
}

/** Persists a calendar's epoch anchor on the shared counter (cross-calendar
 *  link calibration, S5). Only the linked calendar moves; the reference stays. */
export async function updateCalendarAnchor(db: DatabaseLike, id: string, epochAnchorDay: number): Promise<void> {
  await db.execute('UPDATE calendars SET epoch_anchor_day = ? WHERE id = ?', [epochAnchorDay, id]);
}

/** Deletes a calendar and its eras. Events are unaffected (pinned to the shared counter). */
export async function deleteCalendar(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM eras WHERE calendar_id = ?', [id]);
  await db.execute('DELETE FROM calendars WHERE id = ?', [id]);
}

export function importCalendarFromJson(json: string): unknown {
  return JSON.parse(json);
}

export function formatAbsoluteDay(day: number): string {
  return `Day ${day}`;
}
