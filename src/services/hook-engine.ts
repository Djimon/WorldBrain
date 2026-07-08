// M12-S07: Ergebnis→Effekt-Hooks & gated Dice — stub, implement in GREEN
// phase (#232). Only the enumerated effect verbs (gain/spend/set/set_flag/
// clear) on declared resources/flags — no arbitrary code (Decision 6).
// Effects flow through the resource primitive (S03); its triggers fire
// normally as a result (cascade).

export type EffectDescriptor =
  | { verb: 'gain' | 'spend' | 'set'; resource: string; amount: string }
  | { verb: 'set_flag'; flag: string }
  | { verb: 'clear'; resource: string; amount?: string };

/** Looks up the effect list attached to a specific outcome/band name. */
export function resolveHookEffects(
  _hooks: Record<string, EffectDescriptor[]>,
  _outcome: string,
): EffectDescriptor[] {
  throw new Error('not implemented');
}

/**
 * Resolves an effect's `amount` to a number. A plain formula amount ("1")
 * evaluates via the M9 engine. A dice-notation amount ("1d6") requires an
 * already-delivered roll (Decision 2 — no RNG in core); without one it
 * returns null (awaiting the external roll), never a crash.
 */
export function resolveEffectAmount(
  _descriptor: EffectDescriptor,
  _entity: Record<string, number>,
  _deliveredRoll?: number,
): number | null {
  throw new Error('not implemented');
}

/** Gated dice payload: which expression/dice applies for the delivered outcome. */
export function resolveGatedPayload(
  _descriptor: { onSuccess?: string; onFailure?: string },
  _outcome: 'success' | 'failure',
): string | null {
  throw new Error('not implemented');
}
