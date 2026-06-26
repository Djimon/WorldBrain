import { useState, useEffect } from 'react';
import { listEvents } from '../services/event-service';
import type { DatabaseLike } from '../services/entity-service';

interface MonthDef { name: string; days: number }
interface Calendar {
  id: string;
  title: string;
  year_length_days: number;
  months: MonthDef[];
  week: string[];
}
interface EventItem {
  id: string;
  title: string;
  start_day: number;
  end_day?: number;
  precision: string;
}

interface Props {
  calendar: Calendar;
  database: DatabaseLike;
  onCreateEvent?: (day: number) => void;
}

function monthStartDay(calendar: Calendar, monthIndex: number): number {
  return calendar.months.slice(0, monthIndex).reduce((acc, m) => acc + m.days, 0) + 1;
}

export function CalendarMonthView({ calendar, database, onCreateEvent }: Props) {
  const [monthIndex, setMonthIndex] = useState(0);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    listEvents(database, {}).then(rows => setAllEvents(rows as EventItem[]));
  }, [database]);

  const months = calendar.months.length > 0 ? calendar.months : [{ name: 'Month 1', days: calendar.year_length_days }];
  const currentMonth = months[monthIndex % months.length];
  const startDay = monthStartDay(calendar, monthIndex % months.length);
  const endDay = startDay + currentMonth.days - 1;

  const events = allEvents.filter(e => {
    const evEnd = e.end_day ?? e.start_day;
    return e.start_day <= endDay && evEnd >= startDay;
  });

  function eventsForDay(day: number): EventItem[] {
    return events.filter(e => {
      const evEnd = e.end_day ?? e.start_day;
      return day >= e.start_day && day <= evEnd;
    });
  }

  const weekDays = calendar.week.length > 0 ? calendar.week : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <div>
      <h2>{currentMonth.name}</h2>
      <div>
        <button aria-label="< previous" onClick={() => setMonthIndex(i => Math.max(0, i - 1))}>{'<'}</button>
        <button aria-label="today" onClick={() => setMonthIndex(0)}>Today</button>
        <button aria-label="next >" onClick={() => setMonthIndex(i => i + 1)}>{'>'}</button>
      </div>
      <div role="grid">
        <div role="row">
          {weekDays.map(d => <div key={d} role="columnheader">{d}</div>)}
        </div>
        <div role="row">
          {Array.from({ length: currentMonth.days }, (_, i) => {
            const day = startDay + i;
            const dayEvents = eventsForDay(day);
            return (
              <div
                key={day}
                role="gridcell"
                data-day={day}
                onClick={() => onCreateEvent?.(day)}
              >
                <span>{i + 1}</span>
                {dayEvents.map(e => <div key={e.id}>{e.title}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
