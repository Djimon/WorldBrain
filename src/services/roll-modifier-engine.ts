// M12-S05: Wurf-Modifikatoren — Advantage/Disadvantage & Bonus/Penalty (#230)
// The layer describes/classifies ("roll 2, keep highest") — actual dice
// drawing stays external (M8-S11).

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
export function resolveNetModifier(modifiers: RollModifierDescriptor[]): NetRollModifier {
  const byKind = new Map<'keep' | 'extra-die', RollModifierDescriptor[]>();
  for (const modifier of modifiers) {
    const group = byKind.get(modifier.kind) ?? [];
    group.push(modifier);
    byKind.set(modifier.kind, group);
  }

  for (const [kind, group] of byKind) {
    const bestCount = group.filter((m) => m.keep === 'best').length;
    const worstCount = group.filter((m) => m.keep === 'worst').length;
    const net = bestCount - worstCount;
    if (net !== 0) {
      return { kind, keep: net > 0 ? 'best' : 'worst', count: Math.abs(net) };
    }
  }

  return { kind: 'normal', count: 0 };
}

/** Optional flat passive-score adjustment when a net modifier is active (D&D Passive ±5). */
export function resolvePassiveAdjustment(net: NetRollModifier, flatAmount: number): number {
  if (net.keep === 'best') return flatAmount;
  if (net.keep === 'worst') return -flatAmount;
  return 0;
}
