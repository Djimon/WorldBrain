// M10-S6 (#425): the DM's session-time control panel — the "operated" panel that
// stays SEPARATE from the persistent display strip (SessionTimeBar). It carries:
//   - the day controls (SessionTimeControl: advance +day/week/year, set-absolute), and
//   - the S5 time-of-day setters: mode (realtime | abstract), 24h/12h clock, +1h /
//     set exact time, and phase advance / select.
// DM-only; mounted in the lobby view. `onChanged` fires after any day OR time-of-day
// change so the shell can refresh the display bar (and its calendar view).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  getTimeOfDay, setTimeMode, setClockFormat, setRealtimeMinute, advanceRealtime,
  setPhaseIndex, advancePhase, type TimeOfDayState, type ClockFormat,
} from '../services/session-time-of-day-service';
import { SessionTimeControl } from './SessionTimeControl';
import { Button, Field, Panel, Segmented } from './primitives';

export interface SessionTimeControlsProps {
  database: DatabaseLike;
  campaignId: string;
  /** After any day OR time-of-day change — the shell refreshes the display bar. */
  onChanged?: () => void;
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

export function SessionTimeControls({ database, campaignId, onChanged }: SessionTimeControlsProps) {
  const { t } = useTranslation('multiplayer');
  const [time, setTime] = useState<TimeOfDayState | null>(null);
  const [timeInput, setTimeInput] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setTime(await getTimeOfDay(database, campaignId));
  }, [database, campaignId]);

  useEffect(() => {
    let cancelled = false;
    void getTimeOfDay(database, campaignId).then((s) => { if (!cancelled) setTime(s); });
    return () => { cancelled = true; };
  }, [database, campaignId]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      await reload();
      onChanged?.();
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
    <div className="u-stack u-gap-2">
      {/* Day granularity: the existing SessionTimeControl (advance / set-absolute). */}
      <SessionTimeControl database={database} campaignId={campaignId} onChanged={() => onChanged?.()} />

      {/* Time-of-day (S5): mode toggle + per-mode setters. */}
      {time !== null && (
        <Panel className="u-stack u-gap-2" role="region" aria-label={t('timeOfDay.label')}>
          <h3>{t('timeOfDay.label')}</h3>
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
        </Panel>
      )}
    </div>
  );
}

export default SessionTimeControls;
