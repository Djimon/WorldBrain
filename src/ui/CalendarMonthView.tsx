import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { listEvents } from '../services/event-service';
import type { DatabaseLike } from '../services/entity-service';
import { dateToCounter, eraForYear, eraRelativeYear } from '../../core_data/calendar-schema';
import { listEras } from '../services/era-service';
import type { EraRow } from '../services/era-service';

interface MonthDef { name: string; days: number }
interface Calendar {
  id: string;
  title: string;
  year_length_days: number;
  months: MonthDef[];
  week: string[];
  epoch_anchor_day?: number;
  epoch_label?: string;
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

export function CalendarMonthView({ calendar, database, onCreateEvent }: Props) {
  const months = calendar.months.length > 0 ? calendar.months : [{ name: 'Month 1', days: calendar.year_length_days }];
  const [viewYear, setViewYear] = useState(1);
  const [viewMonthIdx, setViewMonthIdx] = useState(0);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [eraMode, setEraMode] = useState(false);

  useEffect(() => {
    listEvents(database, {}).then(rows => setAllEvents(rows as EventItem[])).catch(console.error);
  }, [database]);

  useEffect(() => {
    listEras(database, calendar.id).then(setEras).catch(console.error);
  }, [database, calendar.id]);

  const monthIdx = ((viewMonthIdx % months.length) + months.length) % months.length;
  const currentMonth = months[monthIdx];

  // Each cell maps to a shared-counter day via the calendar's projection
  // (S1). Events live on the counter, so they land in the right cell for any
  // year — and for calendars with a non-zero epoch anchor.
  function counterFor(day: number): number {
    return dateToCounter(calendar, { year: viewYear, month: monthIdx + 1, day });
  }
  const firstCounter = counterFor(1);
  const lastCounter = counterFor(currentMonth.days);

  const visibleEvents = allEvents.filter(e => {
    const evEnd = e.end_day ?? e.start_day;
    return e.start_day <= lastCounter && evEnd >= firstCounter;
  });
  function eventsForCounter(c: number): EventItem[] {
    return visibleEvents.filter(e => c >= e.start_day && c <= (e.end_day ?? e.start_day));
  }

  function step(delta: number) {
    let m = monthIdx + delta;
    let y = viewYear;
    while (m < 0) { m += months.length; y -= 1; }
    while (m >= months.length) { m -= months.length; y += 1; }
    setViewMonthIdx(m);
    setViewYear(y);
  }
  function today() { setViewYear(1); setViewMonthIdx(0); }

  const weekDays = calendar.week.length > 0 ? calendar.week : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const era = eraForYear(eras, viewYear);
  const yearText = eraMode && era
    ? `${eraRelativeYear(era, viewYear)} ${era.name}`
    : `${viewYear}${era ? ` · ${era.name}` : ''}`;
  const heading = `${currentMonth.name} ${yearText}`;

  return (
    <div className="cal-month">
      <div className="cal-month__bar">
        <button className="cal-month__nav" aria-label="< previous" onClick={() => step(-1)}>{'‹'}</button>
        <button className="cal-month__nav" aria-label="today" onClick={today}>Today</button>
        <button className="cal-month__nav" aria-label="next >" onClick={() => step(1)}>{'›'}</button>
        <h2 className="cal-month__name">{heading}</h2>
        {eras.length > 0 && (
          <button className="cal-month__nav" aria-label="toggle era display" style={{ marginLeft: 'auto' }}
            onClick={() => setEraMode(m => !m)}>
            {eraMode ? 'Global' : 'Ära'}
          </button>
        )}
      </div>
      <div role="grid" className="cal-grid" style={{ '--cal-cols': weekDays.length } as CSSProperties}>
        <div role="row" className="cal-grid__row">
          {weekDays.map(d => <div key={d} role="columnheader" className="cal-grid__dow">{d}</div>)}
        </div>
        <div role="row" className="cal-grid__row">
          {Array.from({ length: currentMonth.days }, (_, i) => {
            const day = i + 1;
            const counterDay = counterFor(day);
            const dayEvents = eventsForCounter(counterDay);
            return (
              <div
                key={day}
                role="gridcell"
                className="cal-grid__day"
                data-day={counterDay}
                onClick={() => onCreateEvent?.(counterDay)}
              >
                <span className="cal-grid__day-num">{day}</span>
                {dayEvents.map(e => <div key={e.id} className="cal-grid__event" title={e.title}>{e.title}</div>)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
