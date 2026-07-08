// M12-S01: Roll-Target & Roll-Richtung — stub, implement in GREEN phase (#226)
// (EPIC-018 Decision 11 — normative shared descriptor grammar for the
// Resolution/Resource layer. Decision 2: the layer never rolls dice itself,
// it classifies an already delivered roll result. `target` should reuse
// evaluateFormula from formula-engine.ts directly — not a second evaluator.)

export type RollDirection = 'under' | 'over' | 'meet';
export type RollOutcome = 'success' | 'failure';

export interface RollTargetDescriptor {
  target: string;
  direction: RollDirection;
  die?: string;
}

export function resolveRollTarget(
  _descriptor: RollTargetDescriptor,
  _entity: Record<string, number>,
): number | null {
  throw new Error('not implemented');
}

export function classifyRoll(
  _descriptor: RollTargetDescriptor,
  _entity: Record<string, number>,
  _rollResult: number,
): RollOutcome | '—' {
  throw new Error('not implemented');
}
