import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
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
    <div className="cal-month">
      <div className="cal-month__bar">
        <button className="cal-month__nav" aria-label="< previous" onClick={() => setMonthIndex(i => Math.max(0, i - 1))}>{'‹'}</button>
        <button className="cal-month__nav" aria-label="today" onClick={() => setMonthIndex(0)}>Today</button>
        <button className="cal-month__nav" aria-label="next >" onClick={() => setMonthIndex(i => i + 1)}>{'›'}</button>
        <h2 className="cal-month__name">{currentMonth.name}</h2>
      </div>
      <div role="grid" className="cal-grid" style={{ '--cal-cols': weekDays.length } as CSSProperties}>
        <div role="row" className="cal-grid__row">
          {weekDays.map(d => <div key={d} role="columnheader" className="cal-grid__dow">{d}</div>)}
        </div>
        <div role="row" className="cal-grid__row">
          {Array.from({ length: currentMonth.days }, (_, i) => {
            const day = startDay + i;
            const dayEvents = eventsForDay(day);
            return (
              <div
                key={day}
                role="gridcell"
                className="cal-grid__day"
                data-day={day}
                onClick={() => onCreateEvent?.(day)}
              >
                <span className="cal-grid__day-num">{i + 1}</span>
                {dayEvents.map(e => <div key={e.id} className="cal-grid__event" title={e.title}>{e.title}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
