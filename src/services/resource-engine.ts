// M12-S03: Resource-Primitiv (Cap, Seed, Schwellen-Flags) (#228)
// seedFrom/max are formulas evaluated via the M9 engine (evaluateFormula) —
// not a second evaluator. Triggers are formulas over
// value/delta_single/delta_session/session_start.

import { evaluateFormula } from './formula-engine';

export interface ResourceTriggerDescriptor {
  when: string;
  set_flag: string;
}

export interface ResourceDescriptor {
  seedFrom: string;
  max: string;
  min?: number;
  triggers?: ResourceTriggerDescriptor[];
}

export interface ResourceState {
  value: number;
  sessionStart: number;
  deltaSession: number;
}

export interface ResourceChangeResult {
  value: number;
  flags: string[];
}

/** Initializes a session-state resource value from `seedFrom` at creation time. */
export function seedResource(
  descriptor: ResourceDescriptor,
  entity: Record<string, number>,
): number | null {
  return evaluateFormula(descriptor.seedFrom, entity);
}

/** Resolves the current cap (`max` formula), clamping the mutable value. */
export function resolveResourceCap(
  descriptor: ResourceDescriptor,
  entity: Record<string, number>,
): number | null {
  return evaluateFormula(descriptor.max, entity);
}

/**
 * Applies a delta to the resource, clamps to [min, max], updates
 * delta_single/delta_session, and evaluates triggers against the new state —
 * returning the new value plus any newly-set flag names.
 */
export function applyResourceChange(
  descriptor: ResourceDescriptor,
  entity: Record<string, number>,
  current: ResourceState,
  delta: number,
): ResourceChangeResult {
  const min = descriptor.min ?? 0;
  const cap = resolveResourceCap(descriptor, entity);

  let value = current.value + delta;
  value = Math.max(value, min);
  if (cap !== null) value = Math.min(value, cap);

  const deltaSession = current.deltaSession + delta;
  const triggerContext: Record<string, number> = {
    ...entity,
    value,
    delta_single: delta,
    delta_session: deltaSession,
    session_start: current.sessionStart,
  };

  const flags: string[] = [];
  for (const trigger of descriptor.triggers ?? []) {
    if (evaluateFormula(trigger.when, triggerContext) === 1) flags.push(trigger.set_flag);
  }

  return { value, flags };
}
