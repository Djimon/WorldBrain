// M12-S09: Cross-Character-Resolution (Opposed / Assist) — stub, implement
// in GREEN phase (#234). Scoped to comparing two already-delivered band
// results (Decision 2/7) — no network/live-sync (that's M10).
// Resource transfer (Rally/Tag-team) is just two effects (spend on source,
// gain on target) expressed via the M12-S07 hook-engine's EffectDescriptor —
// no separate transfer resolver needed (no over-engineering the slice).

export type OpposedResult = 'attacker' | 'defender' | 'tie';

/**
 * Compares two delivered band outcomes: the higher-ranked band (per
 * `bandOrder`, worst..best) wins. On a tied band, the higher `target` value
 * wins (CoC Opposed tie-break). A genuine tie (same band, same target)
 * resolves to 'tie'.
 */
export function resolveOpposed(
  _attacker: { band: string; target: number },
  _defender: { band: string; target: number },
  _bandOrder: string[],
): OpposedResult {
  throw new Error('not implemented');
}
