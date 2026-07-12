import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { listEventEntities } from '../services/event-entity-service';
import type { DatabaseLike } from '../services/entity-service';
import { formatAbsoluteDay } from '../services/calendar-service';

interface EventItem {
  id: string;
  title: string;
  start_day: number;
}

interface Props {
  database: DatabaseLike;
  onEventSelect?: (eventId: string) => void;
}

export function ChronicleView({ database, onEventSelect }: Props) {
  const { t } = useTranslation('nav');
  const [sortAsc, setSortAsc] = useState(true);
  const [rawEvents, setRawEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    listEventEntities(database).then(rows => setRawEvents(rows as EventItem[])).catch(console.error);
  }, [database]);

  const events = sortAsc ? rawEvents : [...rawEvents].reverse();

  return (
    <div>
      <div>
        <span>{t('chronicle')}</span>
        <button onClick={() => setSortAsc(a => !a)}>
          {sortAsc ? 'Sort: asc' : 'Sort: desc'}
        </button>
      </div>
      <ul>
        {events.map(ev => (
          <li key={ev.id} onClick={() => onEventSelect?.(ev.id)}>
            <strong>{ev.title}</strong>
            <span> {formatAbsoluteDay(ev.start_day)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
