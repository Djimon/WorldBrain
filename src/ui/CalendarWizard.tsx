import { useState } from 'react';
import { saveCalendar, importCalendarFromJson } from '../services/calendar-service';
import { CALENDAR_PRESETS } from '../../core_data/calendar-schema';

interface Props {
  onComplete: (calendarId?: string) => void;
  database?: unknown;
}

const STEPS = ['Year Length', 'Months', 'Weekdays'];

export function CalendarWizard({ onComplete, database }: Props) {
  const [step, setStep] = useState(0);
  const [preset, setPreset] = useState('');
  const [yearLength, setYearLength] = useState(365);

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
    const result = saveCalendar(database as never, { yearLength });
    onComplete(result.id);
  }

  function handleImport() {
    const json = prompt('Paste calendar JSON:');
    if (json) importCalendarFromJson(json);
  }

  function handleExport() {
    alert(JSON.stringify({ yearLength, preset }));
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
          <p>Configure your calendar's cycle structure.</p>
        </div>
      )}

      {step === 2 && (
        <div>
          <p>Weekday configuration</p>
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
