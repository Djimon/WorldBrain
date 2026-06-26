import { useState } from 'react';
import { saveCalendar } from '../services/calendar-service';
import { CALENDAR_PRESETS } from '../../core_data/calendar-schema';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  onComplete: (calendarId?: string) => void;
  database: DatabaseLike | undefined;
}

const DEFAULT_PRESET = CALENDAR_PRESETS[0];

export function CalendarWizard({ onComplete, database }: Props) {
  const [title, setTitle] = useState('Mein Kalender');
  const [preset, setPreset] = useState(DEFAULT_PRESET.id);
  const [months, setMonths] = useState(DEFAULT_PRESET.months.map((m) => ({ ...m })));
  const [week, setWeek] = useState([...DEFAULT_PRESET.week]);
  const [saving, setSaving] = useState(false);

  function applyPreset(id: string) {
    setPreset(id);
    const p = CALENDAR_PRESETS.find((x) => x.id === id);
    if (!p) return;
    setMonths(p.months.map((m) => ({ ...m })));
    setWeek([...p.week]);
  }

  function updateMonth(i: number, field: 'name' | 'days', value: string) {
    setMonths((prev) => prev.map((m, idx) => idx === i ? { ...m, [field]: field === 'days' ? Number(value) : value } : m));
  }

  function addMonth() {
    setMonths((prev) => [...prev, { name: `Monat ${prev.length + 1}`, days: 30 }]);
  }

  function removeMonth(i: number) {
    setMonths((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateWeekday(i: number, value: string) {
    setWeek((prev) => prev.map((d, idx) => idx === i ? value : d));
  }

  function addWeekday() {
    setWeek((prev) => [...prev, `Tag ${prev.length + 1}`]);
  }

  function removeWeekday(i: number) {
    setWeek((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!database || !title.trim()) return;
    setSaving(true);
    try {
      const yearLengthDays = months.reduce((s, m) => s + m.days, 0);
      const id = await saveCalendar(database, { title: title.trim(), yearLengthDays, months, week });
      onComplete(id);
    } finally {
      setSaving(false);
    }
  }

  const totalDays = months.reduce((s, m) => s + m.days, 0);

  return (
    <div className="cal-form">
      <div className="cal-form__header">
        <h2 className="cal-form__title">Kalender konfigurieren</h2>
        <button className="btn btn--primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Speichern…' : 'Kalender speichern'}
        </button>
      </div>

      <div className="cal-form__body">
        {/* Grundeinstellungen */}
        <section className="cal-section">
          <h3 className="cal-section__title">Grundeinstellungen</h3>
          <div className="cal-form__row">
            <label className="cal-form__label">Name</label>
            <input
              className="cal-form__input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="z.B. Vergessene Reiche Kalender"
            />
          </div>
          <div className="cal-form__row">
            <label className="cal-form__label">Vorlage</label>
            <select className="cal-form__select" value={preset} onChange={(e) => applyPreset(e.target.value)}>
              {CALENDAR_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="cal-form__row">
            <label className="cal-form__label">Jahrestage</label>
            <input
              className="cal-form__input"
              type="number"
              min={1}
              value={totalDays}
              onChange={(e) => {
                const target = Number(e.target.value);
                if (!target || months.length === 0) return;
                const base = Math.floor(target / months.length);
                const remainder = target % months.length;
                setMonths((prev) => prev.map((m, i) => ({ ...m, days: base + (i < remainder ? 1 : 0) })));
              }}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>= {months.length} Monate × ~{months.length ? Math.round(totalDays / months.length) : 0}</span>
          </div>
        </section>

        <div className="cal-form__columns">
          {/* Monate */}
          <section className="cal-section">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Monate ({months.length})</h3>
              <button className="cal-add-btn" onClick={addMonth}>+ Monat</button>
            </div>
            <div className="cal-month-grid">
              {months.map((m, i) => (
                <div key={i} className="cal-month-row">
                  <span className="cal-month-num">{i + 1}.</span>
                  <input
                    className="cal-form__input cal-month-name"
                    value={m.name}
                    onChange={(e) => updateMonth(i, 'name', e.target.value)}
                    placeholder="Monatsname"
                  />
                  <input
                    className="cal-form__input cal-month-days"
                    type="number"
                    min={1}
                    max={99}
                    value={m.days}
                    onChange={(e) => updateMonth(i, 'days', e.target.value)}
                  />
                  <span className="cal-month-days-label">T</span>
                  <button className="cal-remove-btn" onClick={() => removeMonth(i)} title="Entfernen">✕</button>
                </div>
              ))}
            </div>
          </section>

          {/* Wochentage */}
          <section className="cal-section">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Wochentage ({week.length})</h3>
              <button className="cal-add-btn" onClick={addWeekday}>+ Tag</button>
            </div>
            <div className="cal-week-grid">
              {week.map((d, i) => (
                <div key={i} className="cal-week-row">
                  <span className="cal-month-num">{i + 1}.</span>
                  <input
                    className="cal-form__input"
                    value={d}
                    onChange={(e) => updateWeekday(i, e.target.value)}
                    placeholder="Tagesname"
                  />
                  <button className="cal-remove-btn" onClick={() => removeWeekday(i)} title="Entfernen">✕</button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
