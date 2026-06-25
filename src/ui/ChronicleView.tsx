import { useState } from 'react';
import { listEvents } from '../services/event-service';
import type { DatabaseLike } from '../services/entity-service';
import { formatAbsoluteDay } from '../services/calendar-service';

interface EventItem {
  id: string;
  title: string;
  type: string;
  start_day: number;
  precision: string;
  visibility: string;
}

interface Props {
  database: DatabaseLike;
  onEventSelect?: (eventId: string) => void;
}

export function ChronicleView({ database, onEventSelect }: Props) {
  const [sortAsc, setSortAsc] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  const rawEvents = listEvents(database, {}) as EventItem[];
  let events = typeFilter ? rawEvents.filter(e => e.type === typeFilter) : rawEvents;
  events = sortAsc ? events : [...events].reverse();

  return (
    <div>
      <div>
        <label htmlFor="type-filter">Event Type</label>
        <select
          id="type-filter"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          <option value="historical_event">History</option>
          <option value="session_event">Session</option>
          <option value="rumor">Rumor</option>
          <option value="prophecy">Prophecy</option>
        </select>
        <button onClick={() => setSortAsc(a => !a)}>
          {sortAsc ? 'Sort: asc' : 'Sort: desc'}
        </button>
      </div>
      <ul>
        {events.map(ev => (
          <li key={ev.id} onClick={() => onEventSelect?.(ev.id)}>
            <strong>{ev.title}</strong>
            <span> {ev.type}</span>
            {ev.precision !== 'vague' && <span> {formatAbsoluteDay(ev.start_day)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
