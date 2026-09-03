// M10-S5 (#424): time-of-day as campaign/session state.
//
// The calendar stays day-granular (`CalendarDate = {year,month,day}`) and entity-linked
// — a clock there would bloat it. Time-of-day is therefore ONLY campaign/session state,
// persisted in `campaign_time_of_day` (a validated JSON blob, campaign-scoped), never in
// the calendar schema. Two modes:
//   - realtime: a wall clock (minute of day), rendered 24h or 12h am/pm.
//   - abstract: an ordered list of named phases (DM-editable), with a current index.
// This module is logic/persistence only; the view-independent display bar is S6 (#425).
import type { DatabaseLike } from './entity-service';

export type TimeMode = 'realtime' | 'abstract';
export type ClockFormat = '24h' | '12h';

export interface TimeOfDayState {
  mode: TimeMode;
  /** realtime rendering: 24-hour or 12-hour am/pm. */
  clockFormat: ClockFormat;
  /** realtime clock, minutes since midnight (0..1439). */
  minuteOfDay: number;
  /** abstract mode: ordered phase labels. Defaults are i18n keys; DM edits are literals. */
  phases: string[];
  /** abstract mode: index of the current phase. */
  phaseIndex: number;
}

export const MINUTES_PER_DAY = 1440;

/**
 * The 5 default phases as stable i18n keys (NOT German literals — the data model stays
 * English/neutral per the project i18n rule; the display layer localizes via t()).
 * Morning · Noon · Afternoon · Evening · Night.
 */
export const DEFAULT_PHASES: readonly string[] = [
  'timeOfDay.phase.morning',
  'timeOfDay.phase.noon',
  'timeOfDay.phase.afternoon',
  'timeOfDay.phase.evening',
  'timeOfDay.phase.night',
];

/** New campaigns start in realtime / 24h at 08:00. */
function defaultState(): TimeOfDayState {
  return { mode: 'realtime', clockFormat: '24h', minuteOfDay: 480, phases: [...DEFAULT_PHASES], phaseIndex: 0 };
}

function clampMinute(n: number): number {
  const m = Math.trunc(n) % MINUTES_PER_DAY;
  return m < 0 ? m + MINUTES_PER_DAY : m;
}

/** Validate an untrusted parsed blob into a TimeOfDayState, field-by-field to defaults. */
function coerce(raw: unknown): TimeOfDayState {
  const d = defaultState();
  if (raw === null || typeof raw !== 'object') return d;
  const o = raw as Record<string, unknown>;
  const mode: TimeMode = o.mode === 'abstract' ? 'abstract' : 'realtime';
  const clockFormat: ClockFormat = o.clockFormat === '12h' ? '12h' : '24h';
  const minuteOfDay = typeof o.minuteOfDay === 'number' && Number.isFinite(o.minuteOfDay)
    ? clampMinute(o.minuteOfDay) : d.minuteOfDay;
  const phases = Array.isArray(o.phases) && o.phases.length > 0 && o.phases.every((p) => typeof p === 'string')
    ? (o.phases as string[]) : d.phases;
  const rawIndex = typeof o.phaseIndex === 'number' && Number.isFinite(o.phaseIndex) ? Math.trunc(o.phaseIndex) : 0;
  const phaseIndex = Math.min(Math.max(rawIndex, 0), phases.length - 1);
  return { mode, clockFormat, minuteOfDay, phases, phaseIndex };
}

/** Reads the campaign-scoped time-of-day. No row / invalid JSON → defaults. */
export async function getTimeOfDay(db: DatabaseLike, campaignId: string): Promise<TimeOfDayState> {
  const rows = await db.select<{ state: string }>(
    'SELECT state FROM campaign_time_of_day WHERE campaign_id = ?',
    [campaignId],
  );
  if (rows.length === 0) return defaultState();
  let parsed: unknown = null;
  // JSON.parse of persisted data → safe fallback (AP-006 exception).
  try { parsed = JSON.parse(rows[0].state); } catch { return defaultState(); }
  return coerce(parsed);
}

/** Upsert the full state, campaign-scoped. */
async function writeState(db: DatabaseLike, campaignId: string, state: TimeOfDayState): Promise<void> {
  await db.execute(
    `INSERT INTO campaign_time_of_day (campaign_id, state) VALUES (?, ?)
     ON CONFLICT(campaign_id) DO UPDATE SET state = excluded.state`,
    [campaignId, JSON.stringify(state)],
  );
}

export async function setTimeMode(db: DatabaseLike, params: { campaignId: string; mode: TimeMode }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  await writeState(db, params.campaignId, { ...state, mode: params.mode });
}

export async function setClockFormat(db: DatabaseLike, params: { campaignId: string; clockFormat: ClockFormat }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  await writeState(db, params.campaignId, { ...state, clockFormat: params.clockFormat });
}

/** DM sets the wall clock absolutely (minutes since midnight; wrapped into 0..1439). */
export async function setRealtimeMinute(db: DatabaseLike, params: { campaignId: string; minuteOfDay: number }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  await writeState(db, params.campaignId, { ...state, minuteOfDay: clampMinute(params.minuteOfDay) });
}

/** DM advances the wall clock by a signed minute delta (wraps across midnight). */
export async function advanceRealtime(db: DatabaseLike, params: { campaignId: string; minutes: number }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  await writeState(db, params.campaignId, { ...state, minuteOfDay: clampMinute(state.minuteOfDay + params.minutes) });
}

/** DM replaces the phase list (rename / add / remove). phaseIndex is clamped into range. */
export async function setPhases(db: DatabaseLike, params: { campaignId: string; phases: string[] }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  const phases = params.phases.length > 0 ? params.phases : [...DEFAULT_PHASES];
  const phaseIndex = Math.min(Math.max(state.phaseIndex, 0), phases.length - 1);
  await writeState(db, params.campaignId, { ...state, phases, phaseIndex });
}

/** DM selects a phase by index (clamped into range). */
export async function setPhaseIndex(db: DatabaseLike, params: { campaignId: string; phaseIndex: number }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  const phaseIndex = Math.min(Math.max(Math.trunc(params.phaseIndex), 0), state.phases.length - 1);
  await writeState(db, params.campaignId, { ...state, phaseIndex });
}

/** DM advances to the next phase (wraps to the first). */
export async function advancePhase(db: DatabaseLike, params: { campaignId: string }): Promise<void> {
  const state = await getTimeOfDay(db, params.campaignId);
  const phaseIndex = state.phases.length > 0 ? (state.phaseIndex + 1) % state.phases.length : 0;
  await writeState(db, params.campaignId, { ...state, phaseIndex });
}
