// M12-S08: Track-Felder (markierte Slot-Arrays) (#233)
// `slots` is a formula (M9 engine). `reset_on` names an M12-S04 transition
// trigger — the actual reset is that engine's job.

import { evaluateFormula } from './formula-engine';

export interface TrackDescriptor {
  slots: string;
  on_full?: string;
  on_last_mark?: string;
  reset_on?: string;
}

export interface TrackMarkResult {
  marked: number;
  flags: string[];
}

/** Resolves the track's slot count from its `slots` formula. */
export function resolveTrackSlots(
  descriptor: TrackDescriptor,
  entity: Record<string, number>,
): number | null {
  return evaluateFormula(descriptor.slots, entity);
}

/** Marks `n` additional slots, clamped at the resolved cap, returning any newly-triggered flags. */
export function markTrack(
  descriptor: TrackDescriptor,
  currentMarked: number,
  n: number,
  entity: Record<string, number>,
): TrackMarkResult {
  const cap = resolveTrackSlots(descriptor, entity);
  let marked = Math.max(currentMarked + n, 0);
  if (cap !== null) marked = Math.min(marked, cap);

  const flags: string[] = [];
  if (cap !== null && marked >= cap) {
    if (descriptor.on_full) flags.push(descriptor.on_full);
    if (descriptor.on_last_mark) flags.push(descriptor.on_last_mark);
  }
  return { marked, flags };
}

/** Clears `n` marks, clamped at 0. */
export function clearTrack(currentMarked: number, n: number): number {
  return Math.max(currentMarked - n, 0);
}
