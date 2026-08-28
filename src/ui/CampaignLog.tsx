// M10-D23 (#379): Campaign-weites Log als reine UI-Aggregation über die
// bestehenden session_log-Einträge der Sessions einer Campaign. KEIN neues
// Log-/Datenobjekt — session_log bleibt unverändert. Trennstrich pro
// Session-Wechsel; chronologisch aufsteigend.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { ListSurface, Panel } from './primitives';

export interface CampaignLogProps {
  database: DatabaseLike;
  campaignId: string;
}

interface LogRow {
  id: string;
  session_id: string;
  session_title: string;
  action_type: string;
  payload_json: string;
  created_at: string;
}

export function CampaignLog({ database, campaignId }: CampaignLogProps) {
  const { t } = useTranslation('multiplayer');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId === '') { setRows([]); return; }
    let cancelled = false;
    // JOIN session_log × sessions: chronologisch, Sessions-Titel als Header.
    void database.select<LogRow>(
      `SELECT sl.id, sl.session_id, s.title AS session_title,
              sl.action_type, sl.payload_json, sl.created_at
       FROM session_log sl
       JOIN sessions s ON s.id = sl.session_id
       WHERE s.campaign_id = ?
       ORDER BY sl.created_at ASC`,
      [campaignId],
    ).then((data) => { if (!cancelled) setRows(data); })
     .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, [database, campaignId]);

  // Session-Wechsel → separator (section-header pro Session-Block).
  const items: React.ReactNode[] = [];
  let lastSessionId: string | null = null;
  for (const r of rows) {
    if (r.session_id !== lastSessionId) {
      items.push(
        <li key={`sep-${r.session_id}`} className="campaign-log__separator u-muted">
          — {r.session_title || r.session_id} —
        </li>,
      );
      lastSessionId = r.session_id;
    }
    items.push(
      <li key={r.id} className="campaign-log__entry">
        <span className="u-muted">{r.created_at}</span> · {r.action_type}
      </li>,
    );
  }

  return (
    <Panel className="campaign-log u-stack u-gap-2" role="region"
      aria-label={t('campaignLog.title', 'Campaign-Log')}>
      <h2>{t('campaignLog.title', 'Campaign-Log')}</h2>
      {error !== null && <p className="u-muted">{error}</p>}
      <ListSurface className="campaign-log__list">
        {items.length === 0 && (
          <li className="campaign-log__empty">
            {t('campaignLog.empty', 'Noch keine Einträge in dieser Campaign.')}
          </li>
        )}
        {items}
      </ListSurface>
    </Panel>
  );
}

export default CampaignLog;
