import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { anchorForEquivalence, convertDate } from '../../core_data/calendar-schema';
import { updateCalendarAnchor } from '../services/calendar-service';
import { Button } from './primitives';

export interface CalShape {
  id: string;
  title: string;
  year_length_days: number;
  months: { name: string; days: number }[];
  week: string[];
  epoch_anchor_day: number;
  start_year: number;
  start_month: number;
  start_day: number;
}

interface Props {
  database: DatabaseLike;
  active: CalShape;
  calendars: { id: string; title: string }[];
  loadCalendar: (id: string) => Promise<CalShape | null>;
  onLinked: () => void;
}

type YMD = { year: number; month: number; day: number };
const fmt = (d: YMD) => `${d.day}.${d.month}.${d.year}`;
const startOf = (c: CalShape): YMD => ({ year: c.start_year, month: c.start_month, day: c.start_day });

// Cross-calendar link: the user states one date equivalence in plain calendar
// terms (no internal counter shown); this calibrates the TARGET calendar's
// anchor so both dates align. The active (reference) calendar is untouched.
export function CalendarLinkPanel({ database, active, calendars, loadCalendar, onLinked }: Props) {
  const others = calendars.filter((c) => c.id !== active.id);
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState(others[0]?.id ?? '');
  const [target, setTarget] = useState<CalShape | null>(null);
  const [aDate, setADate] = useState<YMD>(startOf(active));
  const [bDate, setBDate] = useState<YMD>({ year: 1, month: 1, day: 1 });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!targetId) { setTarget(null); return; }
    loadCalendar(targetId).then((cal) => {
      setTarget(cal);
      if (cal) setBDate(startOf(cal)); // prefill target's own start date
    }).catch(console.error);
  }, [targetId, loadCalendar]);

  function link() {
    if (!target) return;
    const anchor = anchorForEquivalence(active, aDate, target, bDate);
    void updateCalendarAnchor(database, target.id, anchor).then(() => {
      setStatus(`Verknüpft: ${active.title} ${fmt(aDate)} = ${target.title} ${fmt(bDate)}`);
      onLinked();
    }).catch(console.error);
  }

  if (others.length === 0) return null;

  return (
    <section className="cal-section cal-link">
      <button className="cal-link__toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {open ? '▾' : '▸'} Kalender verknüpfen
      </button>
      {open && (
        <>
          <div className="cal-link__row">
            <span className="cal-link__cal">{active.title}</span>
            <LabeledDate value={aDate} onChange={setADate} />
            <span className="cal-link__eq">=</span>
            <select className="cal-form__select" value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Ziel-Kalender">
              {others.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
            <LabeledDate value={bDate} onChange={setBDate} />
            <Button tone="accent" onClick={link} disabled={!target}>Verknüpfen</Button>
          </div>
          {target && (
            <div className="cal-link__preview">
              Vorschau: {active.title} {fmt(aDate)} → {target.title}{' '}
              {fmt(convertDate(active, aDate, { ...target, epoch_anchor_day: anchorForEquivalence(active, aDate, target, bDate) }))}
            </div>
          )}
          {status && <div className="cal-link__status">{status}</div>}
        </>
      )}
    </section>
  );
}

function LabeledDate({ value, onChange }: { value: YMD; onChange: (v: YMD) => void }) {
  return (
    <span className="cal-datefield">
      <span className="cal-datefield__unit">
        <input className="cal-form__input cal-month-days" type="number" aria-label="Tag" value={value.day}
          onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
        <span className="cal-datefield__label">Tag</span>
      </span>
      <span className="cal-datefield__unit">
        <input className="cal-form__input cal-month-days" type="number" aria-label="Monat" value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })} />
        <span className="cal-datefield__label">Monat</span>
      </span>
      <span className="cal-datefield__unit">
        <input className="cal-form__input cal-year-input" type="number" aria-label="Jahr" value={value.year}
          onChange={(e) => onChange({ ...value, year: Number(e.target.value) })} />
        <span className="cal-datefield__label">Jahr</span>
      </span>
    </span>
  );
}
