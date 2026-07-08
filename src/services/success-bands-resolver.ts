// M12-S02: Success-Bands / Degrees of Success — stub, implement in GREEN phase (#227)
// (EPIC-018 Decision 11 grammar: band "when" expressions are formulas over
// the same evaluateFormula context as M12-S01, with `roll` + `target` (and
// other entity fields) available — not a second evaluator.)

export interface BandDescriptor {
  name: string;
  when: string;
}

/**
 * Classify a delivered roll into the first matching band (ordered,
 * first-match-wins). Returns '—' when no band matches or the config/context
 * is broken — never throws.
 */
export function classifyBand(
  _bands: BandDescriptor[],
  _context: Record<string, number>,
): string | '—' {
  throw new Error('not implemented');
}

/**
 * Shift the current band by `shift` steps along `orderedBands` (best..worst
 * or worst..best, caller-defined order), clamped at both ends.
 */
export function applyBandShift(
  _orderedBands: string[],
  _currentBand: string,
  _shift: number,
): string {
  throw new Error('not implemented');
}
