// M14-S12: Effekt-Editor im Event-Formular (#267)
// Manages an Event entity's properties.effects (S09 event-effects-service)
// list: add/remove, with client-side S08 target/verb validation gating
// "hinzufügen" before any addEffect call (Decision — invalid never saved).
//
// Assumption (undocumented in AC, same reasoning as EventFormFields.tsx):
// the day field is a plain counter-day number input, not the full
// CalendarDateInput widget — that needs the active calendar object +
// counter<->date conversion, which is presentation-layer wiring for the
// Implementation Agent, not a behavioral requirement this test file needs
// to pin down.
import type { DatabaseLike } from '../services/entity-service';

export interface EffectEditorProps {
  database: DatabaseLike;
  eventId: string;
  startDay: number;
}

export function EffectEditor(_props: EffectEditorProps): never {
  throw new Error('not implemented');
}
