// M14-S03: Clamped date widget CalendarDateInput (#258)
// Reusable y/m/d input for Event- and era-date. Month/day definition comes
// entirely from the `months` prop — no hard 12-month/length assumption.
// Only the year is signed/unbounded (Decision 4); day/month always clamp.

import { useState } from 'react';

export interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

export interface MonthDef {
  name: string;
  days: number;
}

export interface CalendarDateInputProps {
  months: MonthDef[];
  value: CalendarDate;
  onChange: (value: CalendarDate) => void;
}

export function CalendarDateInput({ months, value, onChange }: CalendarDateInputProps) {
  const [snapping, setSnapping] = useState(false);

  function triggerSnapCue() {
    setSnapping(true);
    setTimeout(() => setSnapping(false), 300);
  }

  function parseOr(raw: string, fallback: number): number {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  function handleDayChange(raw: string) {
    const maxDay = months[value.month - 1]?.days ?? 1;
    const day = Math.min(Math.max(parseOr(raw, 1), 1), maxDay);
    onChange({ ...value, day });
  }

  function handleMonthChange(raw: string) {
    const month = Math.min(Math.max(parseOr(raw, 1), 1), months.length);
    const maxDay = months[month - 1]?.days ?? 1;
    if (value.day > maxDay) {
      triggerSnapCue();
      onChange({ ...value, month, day: maxDay });
    } else {
      onChange({ ...value, month });
    }
  }

  function handleYearChange(raw: string) {
    onChange({ ...value, year: parseOr(raw, value.year) });
  }

  return (
    <span className="cal-dateinput">
      <span className="cal-dateinput__unit">
        <input
          type="number"
          role="spinbutton"
          aria-label="Tag"
          className={snapping ? 'cal-dateinput__day cal-dateinput--snap' : 'cal-dateinput__day'}
          value={value.day}
          onChange={(e) => handleDayChange(e.target.value)}
        />
        <span className="cal-dateinput__label">Tag</span>
      </span>
      <span className="cal-dateinput__unit">
        <input
          type="number"
          role="spinbutton"
          aria-label="Monat"
          className="cal-dateinput__month"
          value={value.month}
          onChange={(e) => handleMonthChange(e.target.value)}
        />
        <span className="cal-dateinput__label">Monat</span>
      </span>
      <span className="cal-dateinput__unit">
        <input
          type="number"
          role="spinbutton"
          aria-label="Jahr"
          className="cal-dateinput__year"
          value={value.year}
          onChange={(e) => handleYearChange(e.target.value)}
        />
        <span className="cal-dateinput__label">Jahr</span>
      </span>
    </span>
  );
}
