// M10-S6 (#425): the persistent, view-INDEPENDENT session bar — DISPLAY ONLY.
//
// A thin strip mounted in the play shell (WorkspaceShell), ABOVE the per-view
// content, so it stays visible no matter which play-sidebar view is active. It
// shows the campaign DATE (era-aware, from the calendar + S1 session-now) and
// TIME OF DAY (S5: realtime clock 24h/12h OR abstract phase) — for DM AND players.
//
// It carries NO controls: the DM operates the day + time-of-day from the SEPARATE
// SessionTimeControls panel (in the lobby). `refreshToken` lets the shell tell the
// bar to re-read after the DM changed something there.
//
// Data source note (D30 membrane): reads the host DB directly, same as the other
// play views today; re-pointing the player's read at the play-client-store is the
// membrane story S8 (#427) — a data-source change, not a re-layout.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getSessionNow } from '../services/session-time-service';
import { loadActiveCalendar, type CalendarRow } from '../services/calendar-service';
import { listEras, type EraRow } from '../services/era-service';
import { formatCalendarDateWithEras } from '../../core_data/calendar-schema';
import { getTimeOfDay, type TimeOfDayState, type ClockFormat } from '../services/session-time-of-day-service';
import { StatusChip } from './primitives';

export interface SessionTimeBarProps {
  database: DatabaseLike;
  campaignId: string;
  /** Bumped by the DM's SessionTimeControls after a change → the bar re-reads. */
  refreshToken?: number;
}

/** Minutes-since-midnight → "HH:MM" (24h) or "H:MM AM/PM" (12h). */
function formatClock(minute: number, format: ClockFormat): string {
  const h = Math.floor(minute / 60);
  const mm = String(minute % 60).padStart(2, '0');
  if (format === '12h') {
    const period = h < 12 ? 'AM' : 'PM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${mm} ${period}`;
  }
  return `${String(h).padStart(2, '0')}:${mm}`;
}

export function SessionTimeBar({ database, campaignId, refreshToken }: SessionTimeBarProps) {
  const { t } = useTranslation('multiplayer');
  const [day, setDay] = useState<number>(0);
  const [calendar, setCalendar] = useState<CalendarRow | null>(null);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [time, setTime] = useState<TimeOfDayState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const now = await getSessionNow(database, campaignId);
      const cal = await loadActiveCalendar(database);
      const eraRows = cal ? await listEras(database, cal.id) : [];
      const tod = await getTimeOfDay(database, campaignId);
      if (cancelled) return;
      setDay(now.day);
      setCalendar(cal);
      setEras(eraRows);
      setTime(tod);
    })();
    return () => { cancelled = true; };
  }, [database, campaignId, refreshToken]);

  const dateText = calendar
    ? formatCalendarDateWithEras(calendar, eras, day)
    : t('sessionTime.dateFallback', { day });

  const timeText = time === null
    ? '—'
    : time.mode === 'realtime'
      ? formatClock(time.minuteOfDay, time.clockFormat)
      : t(time.phases[time.phaseIndex] ?? '', {
          defaultValue: time.phases[time.phaseIndex] ?? '—',
        });

  return (
    <div className="session-time-bar" role="region" aria-label={t('sessionTime.barLabel')}>
      <span className="session-time-bar__item">
        <span aria-hidden="true">📅</span>
        <span className="u-muted">{t('sessionTime.dateLabel')}:</span>
        <strong>{dateText}</strong>
      </span>
      <span className="session-time-bar__item">
        <span aria-hidden="true">🕐</span>
        <span className="u-muted">{t('timeOfDay.label')}:</span>
        <StatusChip tone="accent">{timeText}</StatusChip>
      </span>
    </div>
  );
}

export default SessionTimeBar;
