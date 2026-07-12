// M12-S07: Ergebnis→Effekt-Hooks & gated Dice (#232)
// Only the enumerated effect verbs (gain/spend/set/set_flag/clear) on
// declared resources/flags — no arbitrary code (Decision 6). Effects flow
// through the resource primitive (S03); its triggers fire normally as a
// result (cascade).
//
// M14-S14 (#269): verbs reference the S08 shared vocabulary (effect-
// vocabulary.ts) — no duplicate verb definition. Targets reuse S08's
// parseTarget for world:/entity:; char:/session: are the prefixes S08
// reserves for V1 (EPIC-022) — M12 is the consumer they're reserved for,
// so they're active here instead of rejected.

import { evaluateFormula } from './formula-engine';
import type { EffectVerb } from './effect-vocabulary';

export type EffectDescriptor =
  | { verb: Extract<EffectVerb, 'gain' | 'spend' | 'set'>; resource: string; amount: string }
  | { verb: Extract<EffectVerb, 'set_flag'>; flag: string }
  | { verb: Extract<EffectVerb, 'clear'>; resource: string; amount?: string };

export type HookTarget =
  | { scope: 'world'; name: string }
  | { scope: 'entity'; id: string; field: 'status' }
  | { scope: 'char'; id: string; resource: string }
  | { scope: 'session'; name: string };

/**
 * Resolves a hook effect's target. Delegates world:/entity: parsing to the
 * shared S08 parser (effect-vocabulary.ts). char:<charId>:<resource> and
 * session:<name> are active in M12's context (S08 only reserves the
 * prefixes for V1/EPIC-022, which doesn't consume them).
 */
export function resolveHookTarget(_target: string): HookTarget {
  throw new Error('not implemented');
}

/** Looks up the effect list attached to a specific outcome/band name. */
export function resolveHookEffects(
  hooks: Record<string, EffectDescriptor[]>,
  outcome: string,
): EffectDescriptor[] {
  return hooks[outcome] ?? [];
}

/**
 * Resolves an effect's `amount` to a number. A plain formula amount ("1")
 * evaluates via the M9 engine. A dice-notation amount ("1d6") fails to parse
 * as a formula (evaluateFormula -> null) and requires an already-delivered
 * roll (Decision 2 — no RNG in core); without one it returns null (awaiting
 * the external roll), never a crash.
 */
export function resolveEffectAmount(
  descriptor: EffectDescriptor,
  entity: Record<string, number>,
  deliveredRoll?: number,
): number | null {
  if (!('amount' in descriptor) || descriptor.amount === undefined) return null;
  const resolved = evaluateFormula(descriptor.amount, entity);
  if (resolved !== null) return resolved;
  return deliveredRoll ?? null;
}

/** Gated dice payload: which expression/dice applies for the delivered outcome. */
export function resolveGatedPayload(
  descriptor: { onSuccess?: string; onFailure?: string },
  outcome: 'success' | 'failure',
): string | null {
  return (outcome === 'success' ? descriptor.onSuccess : descriptor.onFailure) ?? null;
}
