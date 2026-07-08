// M12-S07: Ergebnis→Effekt-Hooks & gated Dice (#232)
// Only the enumerated effect verbs (gain/spend/set/set_flag/clear) on
// declared resources/flags — no arbitrary code (Decision 6). Effects flow
// through the resource primitive (S03); its triggers fire normally as a
// result (cascade).

import { evaluateFormula } from './formula-engine';

export type EffectDescriptor =
  | { verb: 'gain' | 'spend' | 'set'; resource: string; amount: string }
  | { verb: 'set_flag'; flag: string }
  | { verb: 'clear'; resource: string; amount?: string };

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
