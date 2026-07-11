// M14-S03: Geklemmtes Datums-Widget CalendarDateInput (#258)
// Reusable y/m/d input for Event- and Ära-date. Month/day definition comes
// entirely from the `months` prop — no hard 12-month/length assumption.

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

export function CalendarDateInput(_props: CalendarDateInputProps): never {
  throw new Error('not implemented');
}
