import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveCalendar } from '../services/calendar-service';
import { listEras, saveEra, deleteEra } from '../services/era-service';
import type { EraRow } from '../services/era-service';
import { CALENDAR_PRESETS } from '../../core_data/calendar-schema';
import type { DatabaseLike } from '../services/entity-service';

interface CalendarInitial {
  id?: string;
  title: string;
  months: { name: string; days: number }[];
  week: string[];
  start?: { year: number; month: number; day: number };
}

interface Props {
  onComplete: (calendarId?: string) => void;
  database: DatabaseLike | undefined;
  /** Existing calendar to edit; when absent the wizard starts from the default preset. */
  initial?: CalendarInitial;
  /** Shown as an "Abbrechen" button when editing an existing calendar. */
  onCancel?: () => void;
}

const DEFAULT_PRESET = CALENDAR_PRESETS[0];

type WizardTab = 'months' | 'weekdays' | 'eras';

export function CalendarWizard({ onComplete, database, initial, onCancel }: Props) {
  const { t } = useTranslation('nav');
  const [title, setTitle] = useState(initial?.title ?? t('calendar'));
  const [preset, setPreset] = useState(DEFAULT_PRESET.id);
  const [months, setMonths] = useState(
    initial?.months?.length ? initial.months.map((m) => ({ ...m })) : DEFAULT_PRESET.months.map((m) => ({ ...m })),
  );
  const [week, setWeek] = useState(initial?.week?.length ? [...initial.week] : [...DEFAULT_PRESET.week]);
  const [start, setStart] = useState(initial?.start ?? { year: 1, month: 1, day: 1 });
  const [tab, setTab] = useState<WizardTab>('months');
  const [saving, setSaving] = useState(false);
  const [eras, setEras] = useState<EraRow[]>([]);

  const calendarId = initial?.id;
  function reloadEras() {
    if (!database || !calendarId) return;
    listEras(database, calendarId).then(setEras).catch(console.error);
  }
  useEffect(() => { reloadEras(); }, [database, calendarId]);

  async function addEra() {
    if (!database || !calendarId) return;
    const lastStart = eras.length ? Math.max(...eras.map((e) => e.start_year)) : 0;
    await saveEra(database, { calendar_id: calendarId, name: 'Neue Ära', start_year: lastStart + 1, year_number_at_start: 1 });
    reloadEras();
  }
  async function updateEra(era: EraRow, patch: Partial<EraRow>) {
    if (!database) return;
    await saveEra(database, { ...era, ...patch });
    reloadEras();
  }
  async function removeEra(id: string) {
    if (!database) return;
    await deleteEra(database, id);
    reloadEras();
  }

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
      const id = await saveCalendar(database, { title: title.trim(), yearLengthDays, months, week, start }, initial?.id);
      onComplete(id);
    } finally {
      setSaving(false);
    }
  }

  const totalDays = months.reduce((s, m) => s + m.days, 0);
  const weekLen = week.length || 1;
  const fullWeeks = Math.floor(totalDays / weekLen);
  const remDays = totalDays % weekLen;

  return (
    <div className="cal-form">
      <div className="cal-form__header">
        <h2 className="cal-form__title">Kalender konfigurieren</h2>
        <button className="btn btn--primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Speichern…' : 'Kalender speichern'}
        </button>
        {onCancel && (
          <button className="btn" onClick={onCancel} disabled={saving}>Abbrechen</button>
        )}
      </div>

      {/* Live-Summe: aktualisiert sich bei jeder Monats-/Wochentag-Änderung */}
      <div className="cal-form__summary">
        <span className="cal-form__summary-item"><strong>{totalDays}</strong> Tage/Jahr</span>
        <span className="cal-form__summary-sep">·</span>
        <span className="cal-form__summary-item">
          <strong>{fullWeeks}</strong> Wochen{remDays > 0 ? ` + ${remDays} ${remDays === 1 ? 'Tag' : 'Tage'}` : ''}
        </span>
        <span className="cal-form__summary-sep">·</span>
        <span className="cal-form__summary-item">{months.length} Monate</span>
        <span className="cal-form__summary-sep">·</span>
        <span className="cal-form__summary-item">{week.length} Tage/Woche</span>
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
          <div className="cal-form__row">
            <label className="cal-form__label">Startdatum</label>
            <span className="cal-datefield">
              <span className="cal-datefield__unit">
                <input className="cal-form__input cal-month-days" type="number" value={start.day}
                  onChange={(e) => setStart((s) => ({ ...s, day: Number(e.target.value) }))} aria-label="Starttag" />
                <span className="cal-datefield__label">Tag</span>
              </span>
              <span className="cal-datefield__unit">
                <input className="cal-form__input cal-month-days" type="number" value={start.month}
                  onChange={(e) => setStart((s) => ({ ...s, month: Number(e.target.value) }))} aria-label="Startmonat" />
                <span className="cal-datefield__label">Monat</span>
              </span>
              <span className="cal-datefield__unit">
                <input className="cal-form__input cal-month-days" type="number" value={start.year}
                  onChange={(e) => setStart((s) => ({ ...s, year: Number(e.target.value) }))} aria-label="Startjahr" />
                <span className="cal-datefield__label">Jahr</span>
              </span>
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>„Die Welt beginnt an diesem Datum"</span>
          </div>
        </section>

        {/* Tabs — je Bereich volle Breite, kein Platz-Konkurrieren */}
        <div className="cal-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'months'} className={`cal-tab${tab === 'months' ? ' active' : ''}`} onClick={() => setTab('months')}>Monate ({months.length})</button>
          <button role="tab" aria-selected={tab === 'weekdays'} className={`cal-tab${tab === 'weekdays' ? ' active' : ''}`} onClick={() => setTab('weekdays')}>Wochentage ({week.length})</button>
          {calendarId && (
            <button role="tab" aria-selected={tab === 'eras'} className={`cal-tab${tab === 'eras' ? ' active' : ''}`} onClick={() => setTab('eras')}>Ären ({eras.length})</button>
          )}
        </div>

        {tab === 'months' && (
          <section className="cal-section">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Monate ({months.length})</h3>
              <button className="cal-add-btn" onClick={addMonth}>+ Monat</button>
            </div>
            <div className="cal-month-grid">
              {months.map((m, i) => (
                <div key={i} className="cal-month-row">
                  <span className="cal-month-num">{i + 1}.</span>
                  <input className="cal-form__input cal-month-name" value={m.name}
                    onChange={(e) => updateMonth(i, 'name', e.target.value)} placeholder="Monatsname" />
                  <input className="cal-form__input cal-month-days" type="number" min={1} max={99} value={m.days}
                    onChange={(e) => updateMonth(i, 'days', e.target.value)} />
                  <span className="cal-month-days-label">T</span>
                  <button className="cal-remove-btn" onClick={() => removeMonth(i)} title="Entfernen">✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'weekdays' && (
          <section className="cal-section">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Wochentage ({week.length})</h3>
              <button className="cal-add-btn" onClick={addWeekday}>+ Tag</button>
            </div>
            <div className="cal-week-grid">
              {week.map((d, i) => (
                <div key={i} className="cal-week-row">
                  <span className="cal-month-num">{i + 1}.</span>
                  <input className="cal-form__input" value={d}
                    onChange={(e) => updateWeekday(i, e.target.value)} placeholder="Tagesname" />
                  <button className="cal-remove-btn" onClick={() => removeWeekday(i)} title="Entfernen">✕</button>
                </div>
              ))}
            </div>
          </section>
        )}

        {tab === 'eras' && calendarId && (
          <section className="cal-section">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Ären ({eras.length})</h3>
              <button className="cal-add-btn" onClick={() => void addEra()}>+ Ära</button>
            </div>
            <div className="cal-era-grid">
              {eras.map((e) => (
                <div key={e.id} className="cal-era-row">
                  <input className="cal-form__input cal-era-name" value={e.name}
                    onChange={(ev) => void updateEra(e, { name: ev.target.value })} placeholder="Ära-Name" />
                  <input className="cal-form__input cal-month-days" type="number" value={e.start_year}
                    onChange={(ev) => void updateEra(e, { start_year: Number(ev.target.value) })} title="Startjahr (global)" />
                  <span className="cal-month-days-label">ab Jahr</span>
                  <button className="cal-remove-btn" onClick={() => void removeEra(e.id)} title="Entfernen">✕</button>
                </div>
              ))}
              {eras.length === 0 && (
                <p className="cal-hint">Noch keine Ären. „+ Ära" legt einen benannten Jahres-Bereich an (z.B. „Ära der Grah" ab Jahr 1).</p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
