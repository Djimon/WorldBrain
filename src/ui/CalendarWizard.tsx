import { useState } from 'react';
import { saveCalendar, importCalendarFromJson } from '../services/calendar-service';
import { CALENDAR_PRESETS } from '../../core_data/calendar-schema';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  onComplete: (calendarId?: string) => void;
  database: DatabaseLike | undefined;
}

const STEPS = ['Year Length', 'Months', 'Weekdays'];

export function CalendarWizard({ onComplete, database }: Props) {
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState('');
  const [yearLength, setYearLength] = useState(365);
  const [monthCount, setMonthCount] = useState(12);
  const [weekdayCount, setWeekdayCount] = useState(7);
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [importText, setImportText] = useState('');
  const [exportText, setExportText] = useState('');

  function handlePresetChange(value: string) {
    setPreset(value);
    const found = CALENDAR_PRESETS.find(p => p.id === value);
    if (found) setYearLength(found.year_length_days);
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
  }

  function handleBack() {
    if (step > 0) setStep(s => s - 1);
  }

  function handleFinish() {
    const result = saveCalendar(database!, { yearLength, monthCount, weekdayCount });
    onComplete(result.id);
  }

  function handleImport() {
    setShowImport(true);
    setShowExport(false);
  }

  function handleImportConfirm() {
    if (importText.trim()) {
      importCalendarFromJson(importText.trim());
      setShowImport(false);
      setImportText('');
    }
  }

  function handleExport() {
    setExportText(JSON.stringify({ yearLength, monthCount, weekdayCount, preset }));
    setShowExport(true);
    setShowImport(false);
  }

  const isLast = step === STEPS.length - 1;

  return (
    <div>
      <h2>{STEPS[step]}</h2>

      {step === 0 && (
        <div>
          <div>
            <label htmlFor="preset">Preset</label>
            <select
              id="preset"
              value={preset}
              onChange={e => handlePresetChange(e.target.value)}
            >
              <option value="">-- select --</option>
              {CALENDAR_PRESETS.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="year-length">Days per Year</label>
            <input
              id="year-length"
              type="number"
              value={yearLength}
              onChange={e => setYearLength(Number(e.target.value))}
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
          <label htmlFor="month-count">Count</label>
          <input
            id="month-count"
            type="number"
            min={1}
            max={24}
            value={monthCount}
            onChange={e => setMonthCount(Number(e.target.value))}
          />
        </div>
      )}

      {step === 2 && (
        <div>
          <label htmlFor="weekday-count">Days per Week</label>
          <input
            id="weekday-count"
            type="number"
            min={1}
            max={14}
            value={weekdayCount}
            onChange={e => setWeekdayCount(Number(e.target.value))}
          />
        </div>
      )}

      {showImport && (
        <div>
          <textarea
            aria-label="Import JSON"
            value={importText}
            onChange={e => setImportText(e.target.value)}
            placeholder="Paste calendar JSON here…"
            rows={4}
          />
          <button onClick={handleImportConfirm}>Confirm Import</button>
        </div>
      )}

      {showExport && (
        <div>
          <textarea
            aria-label="Export JSON"
            value={exportText}
            readOnly
            rows={4}
          />
        </div>
      )}

      <div>
        {step > 0 && <button onClick={handleBack}>Back</button>}
        {!isLast && <button onClick={handleNext}>Next</button>}
        {isLast && <button onClick={handleFinish}>Finish</button>}
        <button onClick={handleImport}>Import from JSON</button>
        <button onClick={handleExport}>Export to JSON</button>
      </div>
    </div>
  );
}
