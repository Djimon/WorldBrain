// M12-S04: Reset- & Zustands-Übergangs-Phasen — stub, implement in GREEN
// phase (#229). One core action per trigger (e.g. "Long Rest") runs all
// matching transitions for a session-state field/resource atomically.
// `apply_dice` classifies an already-delivered roll (Decision 2) — the
// engine never rolls dice itself.

export type TransitionTrigger = 'short_rest' | 'long_rest' | 'session_start' | 'turn_end' | 'downtime';

export type TransitionAction =
  | { type: 'reset' }
  | { type: 'refill_to_max'; max: number }
  | { type: 'refill_to'; formula: string }
  | { type: 'decrement'; amount?: number }
  | { type: 'set'; formula: string }
  | { type: 'apply_dice'; dice: string; condition?: string; deliveredRoll?: number };

export interface TransitionDescriptor {
  on: TransitionTrigger;
  action: TransitionAction;
}

/** Whether this transition descriptor fires for the given trigger. */
export function appliesOnTrigger(_descriptor: TransitionDescriptor, _trigger: TransitionTrigger): boolean {
  throw new Error('not implemented');
}

/** Applies a single transition's action to the field's current value. */
export function applyTransition(
  _descriptor: TransitionDescriptor,
  _currentValue: number,
  _entity: Record<string, number>,
): number | null {
  throw new Error('not implemented');
}
