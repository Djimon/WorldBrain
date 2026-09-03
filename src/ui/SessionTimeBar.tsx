// M10-S6 (#425): the persistent, view-INDEPENDENT session bar.
//
// Session date + time-of-day used to sit inside the lobby/cockpit — the wrong
// place. This strip is mounted in the play shell (WorkspaceShell), ABOVE the
// per-view content, so it stays visible no matter which play-sidebar view is
// active. It carries:
//   - Date (era-aware "D. Month Year · Era", from the calendar + S1 session-now)
//     and time-of-day (S5: realtime clock 24h/12h OR abstract phase) — for DM AND
//     players.
//   - The DM-only controls: the relocated SessionTimeControl day logic (advance
//     +day/week/year, set-absolute) + the S5 time-of-day setters. Players see the
//     display only, no controls.
//
// Data source note (D30 membrane): this reads the host DB directly, same as the
// other play views today. Re-pointing the player's read at the play-client-store
// is the membrane story S8 (#427) — this bar's props stay role-gated so that swap
// is a data-source change, not a re-layout.
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getSessionNow } from '../services/session-time-service';
import { loadActiveCalendar, type CalendarRow } from '../services/calendar-service';
import { listEras, type EraRow } from '../services/era-service';
import { formatCalendarDateWithEras } from '../../core_data/calendar-schema';
import {
  getTimeOfDay, setTimeMode, setClockFormat, setRealtimeMinute, advanceRealtime,
  setPhaseIndex, advancePhase, type TimeOfDayState, type ClockFormat,
} from '../services/session-time-of-day-service';
import { SessionTimeControl } from './SessionTimeControl';
import { Button, Field, Panel, Segmented, StatusChip } from './primitives';

export interface SessionTimeBarProps {
  database: DatabaseLike;
  campaignId: string;
  /** DMs get the day + time-of-day controls; players see the display only. */
  isDm: boolean;
  /** After the session day changes — the shell can refresh its calendar view. */
  onDayChanged?: () => void;
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

/** "HH:MM" → minutes since midnight, or null when unparseable. */
function parseClock(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function SessionTimeBar({ database, campaignId, isDm, onDayChanged }: SessionTimeBarProps) {
  const { t } = useTranslation('multiplayer');
  const [day, setDay] = useState<number>(0);
  const [calendar, setCalendar] = useState<CalendarRow | null>(null);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [time, setTime] = useState<TimeOfDayState | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [busy, setBusy] = useState(false);

  const reloadTime = useCallback(async () => {
    setTime(await getTimeOfDay(database, campaignId));
  }, [database, campaignId]);

  const reloadDay = useCallback(async () => {
    const now = await getSessionNow(database, campaignId);
    setDay(now.day);
  }, [database, campaignId]);

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
  }, [database, campaignId]);

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

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await reloadTime();
    } finally {
      setBusy(false);
    }
  }

  async function applyTimeInput() {
    const minute = parseClock(timeInput);
    if (minute === null) return;
    await run(() => setRealtimeMinute(database, { campaignId, minuteOfDay: minute }));
    setTimeInput('');
  }

  return (
    <Panel className="session-time-bar u-stack u-gap-2" role="region"
      aria-label={t('sessionTime.barLabel')}>
      <div className="u-row u-gap-3">
        <span className="u-row u-gap-1">
          <span aria-hidden="true">📅</span>
          <span className="u-muted">{t('sessionTime.dateLabel')}:</span>
          <strong>{dateText}</strong>
        </span>
        <span className="u-row u-gap-1">
          <span aria-hidden="true">🕐</span>
          <span className="u-muted">{t('timeOfDay.label')}:</span>
          <StatusChip tone="accent">{timeText}</StatusChip>
        </span>
      </div>

      {isDm && time !== null && (
        <div className="session-time-bar__controls u-stack u-gap-2">
          {/* Day granularity: the relocated SessionTimeControl (advance / set-absolute). */}
          <SessionTimeControl database={database} campaignId={campaignId}
            onChanged={() => { void reloadDay(); onDayChanged?.(); }} />

          {/* Time-of-day (S5): mode toggle + per-mode setters. */}
          <div className="u-row u-gap-2">
            <Segmented
              label={t('timeOfDay.modeLabel')}
              size="compact"
              value={time.mode}
              onChange={(v) => void run(() => setTimeMode(database, { campaignId, mode: v as TimeOfDayState['mode'] }))}
              options={[
                { id: 'realtime', label: t('timeOfDay.modeRealtime') },
                { id: 'abstract', label: t('timeOfDay.modeAbstract') },
              ]}
            />
          </div>

          {time.mode === 'realtime' ? (
            <div className="u-row u-gap-2">
              <Segmented
                label={t('timeOfDay.clockFormatLabel')}
                size="compact"
                value={time.clockFormat}
                onChange={(v) => void run(() => setClockFormat(database, { campaignId, clockFormat: v as ClockFormat }))}
                options={[
                  { id: '24h', label: t('timeOfDay.clock24') },
                  { id: '12h', label: t('timeOfDay.clock12') },
                ]}
              />
              <Button size="compact" disabled={busy}
                onClick={() => void run(() => advanceRealtime(database, { campaignId, minutes: 60 }))}>
                {t('timeOfDay.plusHour')}
              </Button>
              <Field label={t('timeOfDay.setTimeLabel')} type="time" value={timeInput}
                onChange={(e) => setTimeInput(e.target.value)} />
              <Button tone="accent" size="compact" disabled={busy || timeInput === ''}
                onClick={() => void applyTimeInput()}>
                {t('sessionTime.set')}
              </Button>
            </div>
          ) : (
            <div className="u-row u-gap-2">
              <Button size="compact" disabled={busy}
                onClick={() => void run(() => advancePhase(database, { campaignId }))}>
                {t('timeOfDay.nextPhase')}
              </Button>
              <Segmented
                label={t('timeOfDay.phaseLabel')}
                size="compact"
                value={String(time.phaseIndex)}
                onChange={(v) => void run(() => setPhaseIndex(database, { campaignId, phaseIndex: Number(v) }))}
                options={time.phases.map((p, i) => ({
                  id: String(i),
                  label: t(p, { defaultValue: p }),
                }))}
              />
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

export default SessionTimeBar;
