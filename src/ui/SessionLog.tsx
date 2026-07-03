import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listLogEntries } from '../services/session-log-service';
import type { LogEntry } from '../services/session-log-service';
import type { DatabaseLike } from '../services/entity-service';

interface SessionLogProps {
  database: DatabaseLike;
  sessionId: string;
}

export function SessionLog({ database, sessionId }: SessionLogProps) {
  const { t } = useTranslation('session');
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    listLogEntries(database, { sessionId })
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [database, sessionId]);

  const actionTypes = useMemo(
    () => [...new Set(entries.map((e) => e.action_type))],
    [entries],
  );

  const filtered = entries.filter((entry) => {
    if (search && !entry.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter && entry.action_type !== typeFilter) return false;
    return true;
  });

  return (
    <div className="session-log">
      <div className="session-log__controls">
        <input
          type="search"
          aria-label={t('log.search', 'Suche')}
          placeholder={t('log.search', 'Suche')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          aria-label={t('log.filterType', 'Aktionstyp')}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">{t('log.allTypes', 'Alle Typen')}</option>
          {actionTypes.map((at) => (
            <option key={at} value={at}>
              {at}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="session-log__empty">{t('log.empty', 'Der Log ist noch leer')}</p>
      ) : (
        <ul className="session-log__entries">
          {filtered.map((entry) => (
            <li key={entry.id} className="session-log__entry">
              <span className="session-log__world-time">{entry.world_datetime}</span>
              {entry.round != null && (
                <span className="session-log__round">
                  {t('log.round', 'Runde')} {entry.round}
                </span>
              )}
              <span className="session-log__action-type">{entry.action_type}</span>
              <span className="session-log__description">{entry.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
