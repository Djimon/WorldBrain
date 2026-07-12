import { useState, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { listEventEntities } from '../services/event-entity-service';
import type { DatabaseLike } from '../services/entity-service';
import { dateToCounter, erasForRange, eraRelativeYear, eraUnit } from '../../core_data/calendar-schema';
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
  start_year?: number;
  start_month?: number;
  start_day?: number;
}
interface EventItem {
  id: string;
  title: string;
  start_day: number;
  end_day?: number;
}

interface Props {
  calendar: Calendar;
  database: DatabaseLike;
  onCreateEvent?: (day: number) => void;
  refreshToken?: number;
}

export function CalendarMonthView({ calendar, database, onCreateEvent, refreshToken }: Props) {
  const months = calendar.months.length > 0 ? calendar.months : [{ name: 'Month 1', days: calendar.year_length_days }];
  const startYear = calendar.start_year ?? 1;
  const startMonthIdx = (calendar.start_month ?? 1) - 1;
  const [viewYear, setViewYear] = useState(startYear);
  const [viewMonthIdx, setViewMonthIdx] = useState(startMonthIdx);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);
  const [eras, setEras] = useState<EraRow[]>([]);
  const [eraMode, setEraMode] = useState(false);
  const [refEraId, setRefEraId] = useState('');
  const [yearPopoutOpen, setYearPopoutOpen] = useState(false);
  const [yearInput, setYearInput] = useState(String(startYear));
  const [recentYears, setRecentYears] = useState<number[]>([startYear]);

  // M14-S01: MRU of visited years (incl. the initial one) — most-recent
  // first, distinct, capped at 3.
  useEffect(() => {
    setRecentYears((prev) => [viewYear, ...prev.filter((y) => y !== viewYear)].slice(0, 3));
  }, [viewYear]);

  // Reset the view to the calendar's start date when the calendar changes
  // (e.g. the picker switches to another calendar).
  useEffect(() => {
    setViewYear(calendar.start_year ?? 1);
    setViewMonthIdx((calendar.start_month ?? 1) - 1);
  }, [calendar.id, calendar.start_year, calendar.start_month]);

  useEffect(() => {
    listEventEntities(database).then(rows => setAllEvents(rows as EventItem[])).catch(console.error);
  }, [database, refreshToken]);

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
  function today() { setViewYear(startYear); setViewMonthIdx(startMonthIdx); }

  const weekDays = calendar.week.length > 0 ? calendar.week : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Eras may overlap and may leave gaps: collect every era touching the shown
  // month. The reference era (for era-relative years) is user-selectable.
  const matchingEras = erasForRange(eras,
    { year: viewYear, month: monthIdx + 1, day: 1 },
    { year: viewYear, month: monthIdx + 1, day: currentMonth.days });
  const refEra = matchingEras.find((e) => e.id === refEraId) ?? matchingEras[0] ?? null;
  // Era mode: the era-relative year plus the era's official unit ("150 E.K.").
  const yearText = eraMode && refEra
    ? `${eraRelativeYear(refEra, viewYear)} ${eraUnit(refEra)}`
    : `${viewYear}${matchingEras.length ? ` · ${matchingEras.map((e) => e.name).join(', ')}` : ''}`;
  const heading = `${currentMonth.name} ${yearText}`;

  return (
    <div className="cal-month">
      <div className="cal-month__bar">
        <span className="cal-year-nav">
          <button className="cal-month__nav" aria-label="Jahr" onClick={() => setYearPopoutOpen((o) => !o)}>Jahr</button>
          {yearPopoutOpen && (
            <div role="dialog" aria-label="Jahr-Navigation" className="cal-year-popout">
              <div className="cal-year-popout__pills">
                {recentYears.map((y) => (
                  <button key={y} type="button" aria-label={`Jahr ${y}`} className="cal-year-popout__pill"
                    onClick={() => setViewYear(y)}>Jahr {y}</button>
                ))}
              </div>
              <div className="cal-year-popout__adjacent">
                {[-5, -4, -3, -2, -1].map((offset) => (
                  <button key={offset} type="button" aria-label={`Springe zu Jahr ${viewYear + offset}`}
                    className="cal-year-popout__adj-pill" onClick={() => setViewYear(viewYear + offset)}>
                    {viewYear + offset}
                  </button>
                ))}
                <span className="cal-year-popout__active">{viewYear}</span>
                {[1, 2, 3, 4, 5].map((offset) => (
                  <button key={offset} type="button" aria-label={`Springe zu Jahr ${viewYear + offset}`}
                    className="cal-year-popout__adj-pill" onClick={() => setViewYear(viewYear + offset)}>
                    {viewYear + offset}
                  </button>
                ))}
              </div>
              <div className="cal-year-popout__goto">
                <input type="number" role="spinbutton" aria-label="Jahr" className="cal-form__input"
                  value={yearInput} onChange={(e) => setYearInput(e.target.value)} />
                <button type="button" disabled={yearInput === '' || Number.isNaN(Number(yearInput))}
                  onClick={() => setViewYear(Number(yearInput))}>
                  Gehe zu Jahr
                </button>
              </div>
            </div>
          )}
        </span>
        <select className="cal-form__select" aria-label="Monat" value={currentMonth.name}
          onChange={(e) => {
            const idx = months.findIndex((m) => m.name === e.target.value);
            if (idx !== -1) setViewMonthIdx(idx);
          }}>
          {months.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
        </select>
        <button className="cal-month__nav" aria-label="today" onClick={today}>Today</button>
        <button className="cal-month__nav" aria-label="< previous" onClick={() => step(-1)}>{'‹'}</button>
        <button className="cal-month__nav" aria-label="next >" onClick={() => step(1)}>{'›'}</button>
        <h2 className="cal-month__name">{heading}</h2>
        {eras.length > 0 && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            {eraMode && matchingEras.length > 1 && (
              <select className="cal-form__select" aria-label="Bezugs-Ära"
                value={refEra?.id ?? ''} onChange={(e) => setRefEraId(e.target.value)}>
                {matchingEras.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            <span className="cal-yearmode">
              <button className={`cal-yearmode__btn${!eraMode ? ' active' : ''}`} aria-pressed={!eraMode}
                onClick={() => setEraMode(false)}>Global</button>
              <button className={`cal-yearmode__btn${eraMode ? ' active' : ''}`} aria-pressed={eraMode}
                onClick={() => setEraMode(true)}>Ära</button>
            </span>
          </span>
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
