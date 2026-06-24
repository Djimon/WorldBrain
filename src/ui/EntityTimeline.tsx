import { listEvents } from '../services/event-service';

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
  database: unknown;
}

export function EntityTimeline({ entityId, entityType, database }: Props) {
  const isLocation = entityType === 'Location';
  const events = (listEvents(database as never, isLocation
    ? { locationId: entityId }
    : { participantId: entityId }
  ) as EventItem[]);

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
