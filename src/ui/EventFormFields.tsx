// M14-S07: Event-Formular — kind, participants/locations, visibility (#262)
// Event-specific extra fields for the standard entity edit form (title/body
// come from EntityDetailView — not rebuilt here, per this Story's AC).
//
// Assumption (undocumented in AC): the end_day field is a plain counter-day
// number input, matching how start_day is already represented elsewhere
// (e.g. EventQuickCreatePanel's prefilled day). The AC mentions reusing
// CalendarDateInput, but that widget operates on {year,month,day} and would
// require the active calendar object + counter<->date conversion here —
// that wiring is presentation-layer detail for the Implementation Agent,
// not a behavioral requirement this test file needs to pin down.
import type { DatabaseLike } from '../services/entity-service';

export type EventKind = 'single' | 'phase';

export interface EventFormFieldsProps {
  database: DatabaseLike;
  eventId: string;
  kind: EventKind;
  startDay: number;
  endDay?: number;
  onKindChange: (kind: EventKind) => void;
  onEndDayChange: (endDay: number | undefined) => void;
  visibility: string;
  onVisibilityChange: (visibility: string) => void;
}

/** Whether the current kind/day combination is valid to save: phase requires end_day >= start_day. */
export function isEventFormValid(_kind: EventKind, _startDay: number, _endDay: number | undefined): boolean {
  throw new Error('not implemented');
}

export function EventFormFields(_props: EventFormFieldsProps): never {
  throw new Error('not implemented');
}
