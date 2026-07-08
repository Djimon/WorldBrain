// M12-S01: Roll-Target & Roll-Richtung (#226)
// (EPIC-018 Decision 11 — normative shared descriptor grammar for the
// Resolution/Resource layer. Decision 2: the layer never rolls dice itself,
// it classifies an already delivered roll result. `target` reuses
// evaluateFormula from formula-engine.ts directly — not a second evaluator.)

import { evaluateFormula } from './formula-engine';

export type RollDirection = 'under' | 'over' | 'meet';
export type RollOutcome = 'success' | 'failure';

export interface RollTargetDescriptor {
  target: string;
  direction: RollDirection;
  die?: string;
}

/**
 * Resolves the descriptor's target expression (bare field, literal, or
 * formula) against the entity's fields. Returns null — never throws — when
 * the target is unresolvable (unknown field, malformed formula).
 */
export function resolveRollTarget(
  descriptor: RollTargetDescriptor,
  entity: Record<string, number>,
): number | null {
  return evaluateFormula(descriptor.target, entity);
}

/**
 * Classifies a delivered roll against the resolved target: `under` succeeds
 * on roll <= target; `over` and `meet` succeed on roll >= target (Decision 11
 * grammar). An unresolvable target yields "—" instead of a crash.
 */
export function classifyRoll(
  descriptor: RollTargetDescriptor,
  entity: Record<string, number>,
  rollResult: number,
): RollOutcome | '—' {
  const target = resolveRollTarget(descriptor, entity);
  if (target === null) return '—';
  if (descriptor.direction === 'under') return rollResult <= target ? 'success' : 'failure';
  return rollResult >= target ? 'success' : 'failure';
}
