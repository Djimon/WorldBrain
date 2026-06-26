import { useState, useEffect } from 'react';
import { listEvents } from '../services/event-service';
import type { DatabaseLike } from '../services/entity-service';

interface EventItem {
  id: string;
  title: string;
  type: string;
  start_day: number;
  precision: string;
}

interface Props {
  entityId: string;
  entityType: string;
  database: DatabaseLike;
}

export function EntityTimeline({ entityId, entityType, database }: Props) {
  const isLocation = entityType === 'Location';
  const [events, setEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    listEvents(database, isLocation ? { locationId: entityId } : { participantId: entityId })
      .then(rows => setEvents(rows as EventItem[])).catch(console.error);
  }, [database, entityId, entityType]);

  return (
    <div>
      <h3>{entityType} Timeline</h3>
      <ul>
        {events.map(ev => (
          <li key={ev.id}>
            <strong>{ev.title}</strong>
            <span> — Day {ev.start_day}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
