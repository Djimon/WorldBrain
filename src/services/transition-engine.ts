// M12-S04: Reset & state-transition phases (#229)
// One core action per trigger (e.g. "Long Rest") runs all matching
// transitions for a session-state field/resource atomically. `apply_dice`
// classifies an already-delivered roll (Decision 2) — the engine never
// rolls dice itself.

import { evaluateFormula } from './formula-engine';

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
export function appliesOnTrigger(descriptor: TransitionDescriptor, trigger: TransitionTrigger): boolean {
  return descriptor.on === trigger;
}

/** Applies a single transition's action to the field's current value. */
export function applyTransition(
  descriptor: TransitionDescriptor,
  currentValue: number,
  entity: Record<string, number>,
): number | null {
  const { action } = descriptor;
  switch (action.type) {
    case 'reset':
      return 0;
    case 'refill_to_max':
      return action.max;
    case 'refill_to':
      return evaluateFormula(action.formula, entity);
    case 'decrement':
      return Math.max(currentValue - (action.amount ?? 1), 0);
    case 'set':
      return evaluateFormula(action.formula, entity);
    case 'apply_dice': {
      if (action.condition && evaluateFormula(action.condition, entity) !== 1) return currentValue;
      return currentValue + (action.deliveredRoll ?? 0);
    }
  }
}
