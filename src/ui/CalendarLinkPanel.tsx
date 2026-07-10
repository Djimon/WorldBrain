import { useState, useEffect } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { anchorForEquivalence, convertDate } from '../../core_data/calendar-schema';
import { updateCalendarAnchor } from '../services/calendar-service';

export interface CalShape {
  id: string;
  title: string;
  year_length_days: number;
  months: { name: string; days: number }[];
  week: string[];
  epoch_anchor_day: number;
}

interface Props {
  database: DatabaseLike;
  active: CalShape;
  calendars: { id: string; title: string }[];
  loadCalendar: (id: string) => Promise<CalShape | null>;
  onLinked: () => void;
}

const fmt = (d: { year: number; month: number; day: number }) => `${d.day}.${d.month}.${d.year}`;

// Cross-calendar link: the user states one date equivalence in plain calendar
// terms (no internal counter shown); this calibrates the TARGET calendar's
// anchor so both dates align. The active (reference) calendar is untouched.
export function CalendarLinkPanel({ database, active, calendars, loadCalendar, onLinked }: Props) {
  const others = calendars.filter((c) => c.id !== active.id);
  const [targetId, setTargetId] = useState(others[0]?.id ?? '');
  const [target, setTarget] = useState<CalShape | null>(null);
  const [aDate, setADate] = useState({ year: 1, month: 1, day: 1 });
  const [bDate, setBDate] = useState({ year: 1, month: 1, day: 1 });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!targetId) { setTarget(null); return; }
    loadCalendar(targetId).then(setTarget).catch(console.error);
  }, [targetId, loadCalendar]);

  function link() {
    if (!target) return;
    const anchor = anchorForEquivalence(active, aDate, target, bDate);
    void updateCalendarAnchor(database, target.id, anchor).then(() => {
      setStatus(`Verknüpft: ${active.title} ${fmt(aDate)} = ${target.title} ${fmt(bDate)}`);
      onLinked();
    }).catch(console.error);
  }

  // Live check: with the proposed anchor, what does the active date become in
  // the target calendar? (Proves the equivalence before saving.)
  const previewTarget = target
    ? convertDate(active, aDate, { ...target, epoch_anchor_day: anchorForEquivalence(active, aDate, target, bDate) })
    : null;

  if (others.length === 0) return null;

  return (
    <section className="cal-section cal-link">
      <h3 className="cal-section__title">Kalender verknüpfen</h3>
      <div className="cal-link__row">
        <span className="cal-link__cal">{active.title}</span>
        <DateInput value={aDate} onChange={setADate} />
        <span className="cal-link__eq">=</span>
        <select className="cal-form__select" value={targetId} onChange={(e) => setTargetId(e.target.value)} aria-label="Ziel-Kalender">
          {others.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
        <DateInput value={bDate} onChange={setBDate} />
        <button className="btn btn--primary" onClick={link} disabled={!target}>Verknüpfen</button>
      </div>
      {previewTarget && (
        <div className="cal-link__preview">
          Vorschau: {active.title} {fmt(aDate)} → {target?.title} {fmt(previewTarget)}
        </div>
      )}
      {status && <div className="cal-link__status">{status}</div>}
    </section>
  );
}

function DateInput({ value, onChange }: {
  value: { year: number; month: number; day: number };
  onChange: (v: { year: number; month: number; day: number }) => void;
}) {
  return (
    <span className="cal-link__date">
      <input className="cal-form__input cal-month-days" type="number" aria-label="Tag" value={value.day}
        onChange={(e) => onChange({ ...value, day: Number(e.target.value) })} />
      <input className="cal-form__input cal-month-days" type="number" aria-label="Monat" value={value.month}
        onChange={(e) => onChange({ ...value, month: Number(e.target.value) })} />
      <input className="cal-form__input cal-month-days" type="number" aria-label="Jahr" value={value.year}
        onChange={(e) => onChange({ ...value, year: Number(e.target.value) })} />
    </span>
  );
}
