// M12-S05: Wurf-Modifikatoren — Advantage/Disadvantage & Bonus/Penalty —
// stub, implement in GREEN phase (#230). The layer describes/classifies
// ("roll 2, keep highest") — actual dice drawing stays external (M8-S11).

export interface RollModifierDescriptor {
  kind: 'keep' | 'extra-die';
  of: number;
  pool?: 'full' | 'tens';
  keep: 'best' | 'worst';
  stacking?: 'cancel-pairwise' | 'none';
}

export interface NetRollModifier {
  kind: 'keep' | 'extra-die' | 'normal';
  keep?: 'best' | 'worst';
  count: number;
}

/**
 * Resolves a list of stacked roll modifiers into a single net modifier.
 * Pairwise-cancelling modifiers of opposite `keep` within the same `kind`
 * cancel out (D&D advantage+disadvantage → normal; CoC bonus/penalty dice
 * net to whichever side has more).
 */
export function resolveNetModifier(_modifiers: RollModifierDescriptor[]): NetRollModifier {
  throw new Error('not implemented');
}

/** Optional flat passive-score adjustment when a net modifier is active (D&D Passive ±5). */
export function resolvePassiveAdjustment(_net: NetRollModifier, _flatAmount: number): number {
  throw new Error('not implemented');
}
