// M12-S02: Success-Bands / Degrees of Success (#227)
// (EPIC-018 Decision 11 grammar: band "when" expressions are formulas over
// the same evaluateFormula context as M12-S01, with `roll` + `target` (and
// other entity fields) available — not a second evaluator.)

import { evaluateFormula } from './formula-engine';

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
  bands: BandDescriptor[],
  context: Record<string, number>,
): string | '—' {
  for (const band of bands) {
    if (evaluateFormula(band.when, context) === 1) return band.name;
  }
  return '—';
}

/**
 * Shift the current band by `shift` steps along `orderedBands` (best..worst
 * or worst..best, caller-defined order), clamped at both ends.
 */
export function applyBandShift(
  orderedBands: string[],
  currentBand: string,
  shift: number,
): string {
  const index = orderedBands.indexOf(currentBand);
  if (index === -1) return currentBand;
  const clamped = Math.min(Math.max(index + shift, 0), orderedBands.length - 1);
  return orderedBands[clamped];
}
