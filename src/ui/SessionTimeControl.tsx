// M10-S17 (issue 363, D16): DM control for the session time in play mode.
// Advances "session-now" FORWARD (days/weeks/years) OR sets it ABSOLUTELY to
// a specific day (flashback/time jump). Both ways persist
// campaign-scoped; the host-side calendar gate (filterEventsForPlayer)
// acts on the resulting session-now.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getSessionNow, advanceTime, setSessionNow } from '../services/session-time-service';
import { Button, Field, Panel } from './primitives';

export interface SessionTimeControlProps {
  database: DatabaseLike;
  campaignId: string;
  /** After each change — the parent can reload its calendar/event view. */
  onChanged?: () => void;
}

export function SessionTimeControl({ database, campaignId, onChanged }: SessionTimeControlProps) {
  const { t } = useTranslation('multiplayer');
  const [day, setDay] = useState<number>(0);
  const [absoluteInput, setAbsoluteInput] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload() {
    const now = await getSessionNow(database, campaignId);
    setDay(now.day);
  }

  useEffect(() => {
    let cancelled = false;
    void getSessionNow(database, campaignId).then((now) => {
      if (!cancelled) setDay(now.day);
    });
    return () => { cancelled = true; };
  }, [database, campaignId]);

  async function advance(unit: 'days' | 'weeks' | 'years', amount: number) {
    setBusy(true);
    try {
      await advanceTime(database, { campaignId, [unit]: amount });
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function applyAbsolute() {
    const parsed = Number.parseInt(absoluteInput, 10);
    if (Number.isNaN(parsed)) return;
    setBusy(true);
    try {
      await setSessionNow(database, { campaignId, day: parsed });
      setAbsoluteInput('');
      await reload();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel className="session-time-control u-stack u-gap-2" role="region"
      aria-label={t('sessionTime.title', 'Session-Zeit')}>
      <h3>{t('sessionTime.title', 'Session-Zeit')}</h3>
      <p className="u-muted">
        {t('sessionTime.now', 'Session-Jetzt: Tag {{day}}', { day })}
      </p>

      <div className="u-row u-gap-2">
        <span className="u-muted">{t('sessionTime.advance', 'Voranschreiten:')}</span>
        <Button size="compact" disabled={busy} onClick={() => void advance('days', 1)}>
          {t('sessionTime.plusDay', '+1 Tag')}
        </Button>
        <Button size="compact" disabled={busy} onClick={() => void advance('weeks', 1)}>
          {t('sessionTime.plusWeek', '+1 Woche')}
        </Button>
        <Button size="compact" disabled={busy} onClick={() => void advance('years', 1)}>
          {t('sessionTime.plusYear', '+1 Jahr')}
        </Button>
      </div>

      <div className="u-row u-gap-2">
        <Field
          label={t('sessionTime.absoluteLabel', 'Absolut setzen (Tag)')}
          type="number"
          value={absoluteInput}
          onChange={(e) => setAbsoluteInput(e.target.value)}
          placeholder={t('sessionTime.absolutePlaceholder', 'z.B. 42')}
        />
        <Button tone="accent" size="compact" disabled={busy || absoluteInput === ''} onClick={() => void applyAbsolute()}>
          {t('sessionTime.set', 'Setzen')}
        </Button>
      </div>
    </Panel>
  );
}

export default SessionTimeControl;
