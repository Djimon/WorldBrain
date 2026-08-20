import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { saveCalendar } from '../services/calendar-service';
import { listEras, saveEra, deleteEra } from '../services/era-service';
import type { EraRow } from '../services/era-service';
import { CALENDAR_PRESETS } from '../../core_data/calendar-schema';
import type { DatabaseLike } from '../services/entity-service';
import { CalendarDateInput } from './CalendarDateInput';
import { Button, Panel, Tabs } from './primitives';

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

/** An era being edited; `id` is absent until it has been persisted.
 *  Eras carry an explicit start AND end date, may overlap and may leave gaps. */
interface DraftEra {
  id?: string;
  name: string;
  /** Official year unit, e.g. "E.K." */
  abbr: string;
  start_year: number; start_month: number; start_day: number;
  end_year: number; end_month: number; end_day: number;
  year_number_at_start: number;
}

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
  // Eras live in local state so they can also be defined while CREATING a
  // calendar (no calendar_id yet); they are persisted on save.
  const [eras, setEras] = useState<DraftEra[]>([]);
  const [removedEraIds, setRemovedEraIds] = useState<string[]>([]);

  const calendarId = initial?.id;
  useEffect(() => {
    if (!database || !calendarId) return;
    listEras(database, calendarId)
      .then((rows: EraRow[]) => setEras(rows.map((r) => ({ ...r }))))
      .catch(console.error);
  }, [database, calendarId]);

  function addEra() {
    // Default: a new era covers one whole year after the last era's end.
    const baseYear = eras.length ? Math.max(...eras.map((e) => e.end_year)) + 1 : start.year;
    const lastMonth = months.length || 1;
    const lastDay = months[months.length - 1]?.days ?? 1;
    setEras((prev) => [...prev, {
      name: 'Neue Ära', abbr: '',
      start_year: baseYear, start_month: 1, start_day: 1,
      end_year: baseYear, end_month: lastMonth, end_day: lastDay,
      year_number_at_start: 1,
    }]);
  }
  function updateEra(index: number, patch: Partial<DraftEra>) {
    setEras((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  }
  function removeEra(index: number) {
    setEras((prev) => {
      const era = prev[index];
      if (era?.id) setRemovedEraIds((ids) => [...ids, era.id!]);
      return prev.filter((_, i) => i !== index);
    });
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
      // Persist era edits — works for a brand-new calendar too (id exists now).
      for (const eraId of removedEraIds) await deleteEra(database, eraId);
      for (const era of eras) await saveEra(database, { ...era, calendar_id: id });
      setRemovedEraIds([]);
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
        <Button tone="accent" onClick={() => void handleSave()} disabled={saving}>
          {saving ? 'Speichern…' : 'Kalender speichern'}
        </Button>
        {onCancel && (
          <Button onClick={onCancel} disabled={saving}>Abbrechen</Button>
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
        <Panel className="cal-section u-stack u-gap-3">
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
            <span className="cal-wizard__hint">= {months.length} Monate × ~{months.length ? Math.round(totalDays / months.length) : 0}</span>
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
                <input className="cal-form__input cal-year-input" type="number" value={start.year}
                  onChange={(e) => setStart((s) => ({ ...s, year: Number(e.target.value) }))} aria-label="Startjahr" />
                <span className="cal-datefield__label">Jahr</span>
              </span>
            </span>
            <span className="cal-wizard__hint">„Die Welt beginnt an diesem Datum"</span>
          </div>
        </Panel>

        {/* Tabs — je Bereich volle Breite, kein Platz-Konkurrieren */}
        <Tabs
          className="cal-tabs"
          label="Kalender-Bereiche"
          activeId={tab}
          onSelect={(id) => setTab(id as WizardTab)}
          options={[
            { id: 'months', label: `Monate (${months.length})` },
            { id: 'weekdays', label: `Wochentage (${week.length})` },
            { id: 'eras', label: `Ären (${eras.length})` },
          ]}
        />

        {tab === 'months' && (
          <Panel className="cal-section u-stack u-gap-3">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Monate ({months.length})</h3>
              <Button tone="accent" variant="outline" size="compact" onClick={addMonth}>+ Monat</Button>
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
                  <Button variant="ghost" size="compact" onClick={() => removeMonth(i)} title="Entfernen">✕</Button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'weekdays' && (
          <Panel className="cal-section u-stack u-gap-3">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Wochentage ({week.length})</h3>
              <Button tone="accent" variant="outline" size="compact" onClick={addWeekday}>+ Tag</Button>
            </div>
            <div className="cal-week-grid">
              {week.map((d, i) => (
                <div key={i} className="cal-week-row">
                  <span className="cal-month-num">{i + 1}.</span>
                  <input className="cal-form__input" value={d}
                    onChange={(e) => updateWeekday(i, e.target.value)} placeholder="Tagesname" />
                  <Button variant="ghost" size="compact" onClick={() => removeWeekday(i)} title="Entfernen">✕</Button>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {tab === 'eras' && (
          <Panel className="cal-section u-stack u-gap-3">
            <div className="cal-section__head">
              <h3 className="cal-section__title">Ären ({eras.length})</h3>
              <Button tone="accent" variant="outline" size="compact" onClick={addEra}>+ Ära</Button>
            </div>
            <div className="cal-era-grid">
              {eras.map((e, i) => (
                <div key={e.id ?? `draft-${i}`} className="cal-era-row">
                  <div className="cal-era-row__top">
                    <input className="cal-form__input cal-era-name" value={e.name}
                      onChange={(ev) => updateEra(i, { name: ev.target.value })} placeholder="Ära-Name (z.B. Ära der erfrüchtigen Könige)" />
                    <input className="cal-form__input cal-era-abbr" value={e.abbr}
                      onChange={(ev) => updateEra(i, { abbr: ev.target.value })}
                      placeholder="Kürzel" title="Kürzel — offizielle Jahreseinheit, z.B. E.K." />
                    <Button variant="ghost" size="compact" onClick={() => removeEra(i)} title="Entfernen">✕</Button>
                  </div>
                  <div className="cal-era-row__dates">
                    <span className="cal-era-label">Start</span>
                    <CalendarDateInput months={months} value={{ year: e.start_year, month: e.start_month, day: e.start_day }}
                      onChange={(v) => updateEra(i, { start_year: v.year, start_month: v.month, start_day: v.day })} />
                    <span className="cal-era-label">Ende</span>
                    <CalendarDateInput months={months} value={{ year: e.end_year, month: e.end_month, day: e.end_day }}
                      onChange={(v) => updateEra(i, { end_year: v.year, end_month: v.month, end_day: v.day })} />
                    <span className="cal-datefield__unit">
                      <input className="cal-form__input cal-month-days" type="number" value={e.year_number_at_start}
                        onChange={(ev) => updateEra(i, { year_number_at_start: Number(ev.target.value) })}
                        aria-label="Jahr bei Start"
                        title="Welche Jahreszahl trägt das Startjahr der Ära (0 = Startjahr ist Jahr 0)" />
                      <span className="cal-datefield__label">Jahr b. Start</span>
                    </span>
                  </div>
                </div>
              ))}
              {eras.length === 0 && (
                <p className="cal-hint">Noch keine Ären. „+ Ära" legt einen benannten Zeitraum mit festem Start- und Enddatum an. Ären dürfen sich überschneiden und Lücken lassen. Übernahme beim Speichern.</p>
              )}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
