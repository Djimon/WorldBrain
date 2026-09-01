// M10-S17 (#363, D16): Session time + host-side calendar gate.
//
// "Session now" is a campaign-scoped, absolute day counter
// (`campaign_session_now.day`). The DM can ADVANCE it (relative, in
// days/weeks/years) OR SET IT ABSOLUTELY (a concrete day). Both
// persist. The calendar gate is HOST-side: only events with
// start_day <= session now leave the host (Decision 8 — the client never
// filters). Future events are never delivered to the client.
import type { DatabaseLike } from './entity-service';
import { loadActiveCalendar } from './calendar-service';

// Fallback conversion when no active calendar exists. 7-day week,
// 365-day year — applies only to advance-by-weeks/years without a calendar.
const DEFAULT_WEEK_DAYS = 7;
const DEFAULT_YEAR_DAYS = 365;

export interface SessionNow {
  day: number;
}

/**
 * Reads the campaign-scoped session now. With no entry = day 0 (starting point).
 */
export async function getSessionNow(db: DatabaseLike, campaignId: string): Promise<SessionNow> {
  const rows = await db.select<{ day: number }>(
    'SELECT day FROM campaign_session_now WHERE campaign_id = ?',
    [campaignId],
  );
  return { day: rows[0]?.day ?? 0 };
}

/**
 * Sets session now ABSOLUTELY to a concrete day (flashback/time jump).
 * Upsert — persisted campaign-scoped.
 */
export async function setSessionNow(
  db: DatabaseLike,
  params: { campaignId: string; day: number },
): Promise<void> {
  await db.execute(
    `INSERT INTO campaign_session_now (campaign_id, day) VALUES (?, ?)
     ON CONFLICT(campaign_id) DO UPDATE SET day = excluded.day`,
    [params.campaignId, params.day],
  );
}

/**
 * Advances session now — relative, in days/weeks/years. Weeks/years
 * are converted to days via the active calendar (week.length / yearLengthDays);
 * without a calendar, the 7-day week / 365-day year apply.
 */
export async function advanceTime(
  db: DatabaseLike,
  params: { campaignId: string; days?: number; weeks?: number; years?: number },
): Promise<void> {
  const current = await getSessionNow(db, params.campaignId);
  const weeks = params.weeks ?? 0;
  const years = params.years ?? 0;
  // Load the calendar ONLY when weeks/years actually need converting — the
  // pure days advance does not need the calendars table (and must not depend
  // on it, in case no calendar exists).
  let weekDays = DEFAULT_WEEK_DAYS;
  let yearDays = DEFAULT_YEAR_DAYS;
  if (weeks !== 0 || years !== 0) {
    ({ weekDays, yearDays } = await resolveUnitLengths(db));
  }
  const delta = (params.days ?? 0) + weeks * weekDays + years * yearDays;
  await setSessionNow(db, { campaignId: params.campaignId, day: current.day + delta });
}

async function resolveUnitLengths(db: DatabaseLike): Promise<{ weekDays: number; yearDays: number }> {
  const cal = await loadActiveCalendar(db);
  if (cal === null) return { weekDays: DEFAULT_WEEK_DAYS, yearDays: DEFAULT_YEAR_DAYS };
  return {
    weekDays: cal.week.length > 0 ? cal.week.length : DEFAULT_WEEK_DAYS,
    yearDays: cal.year_length_days > 0 ? cal.year_length_days : DEFAULT_YEAR_DAYS,
  };
}

/**
 * HOST-side calendar gate (Decision 8): filters an event list down to
 * those whose start_day <= session now. Future events never leave
 * the host — the client never even gets to see them.
 */
export async function filterEventsBySessionNow<T extends { start_day: number }>(
  db: DatabaseLike,
  params: { campaignId: string; events: T[] },
): Promise<T[]> {
  const now = await getSessionNow(db, params.campaignId);
  return params.events.filter((e) => e.start_day <= now.day);
}
