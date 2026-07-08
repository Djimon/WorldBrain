// M12-S03: Resource-Primitiv (Cap, Seed, Schwellen-Flags) — stub, implement
// in GREEN phase (#228). seedFrom/max are formulas evaluated via the M9
// engine (evaluateFormula) — not a second evaluator. Triggers are formulas
// over value/delta_single/delta_session/session_start.

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
  _descriptor: ResourceDescriptor,
  _entity: Record<string, number>,
): number | null {
  throw new Error('not implemented');
}

/** Resolves the current cap (`max` formula), clamping the mutable value. */
export function resolveResourceCap(
  _descriptor: ResourceDescriptor,
  _entity: Record<string, number>,
): number | null {
  throw new Error('not implemented');
}

/**
 * Applies a delta to the resource, clamps to [min, max], updates
 * delta_single/delta_session, and evaluates triggers against the new state —
 * returning the new value plus any newly-set flag names.
 */
export function applyResourceChange(
  _descriptor: ResourceDescriptor,
  _entity: Record<string, number>,
  _current: ResourceState,
  _delta: number,
): ResourceChangeResult {
  throw new Error('not implemented');
}
