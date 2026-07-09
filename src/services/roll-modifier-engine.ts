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
  kind: 'keep' | 'extra-die';
  keep: 'best' | 'worst';
  count: number;
}

/**
 * Resolves a list of stacked roll modifiers into net modifiers, one per
 * `kind` with a non-zero net (#249 — a kind's net must never be silently
 * dropped when a second, different kind is also active; empty result means
 * no active modifier, i.e. "normal"). Pairwise-cancelling modifiers of
 * opposite `keep` within the same `kind` cancel out (D&D advantage+
 * disadvantage → []; CoC bonus/penalty dice net to whichever side has
 * more). Order of the input list never affects the resulting set.
 */
export function resolveNetModifier(modifiers: RollModifierDescriptor[]): NetRollModifier[] {
  const byKind = new Map<'keep' | 'extra-die', RollModifierDescriptor[]>();
  for (const modifier of modifiers) {
    const group = byKind.get(modifier.kind) ?? [];
    group.push(modifier);
    byKind.set(modifier.kind, group);
  }

  const results: NetRollModifier[] = [];
  for (const [kind, group] of byKind) {
    const bestCount = group.filter((m) => m.keep === 'best').length;
    const worstCount = group.filter((m) => m.keep === 'worst').length;
    const net = bestCount - worstCount;
    if (net !== 0) {
      results.push({ kind, keep: net > 0 ? 'best' : 'worst', count: Math.abs(net) });
    }
  }
  return results;
}

/** Optional flat passive-score adjustment when net modifiers are active (D&D Passive ±5). */
export function resolvePassiveAdjustment(nets: NetRollModifier[], flatAmount: number): number {
  return nets.reduce((total, net) => total + (net.keep === 'best' ? flatAmount : -flatAmount), 0);
}
