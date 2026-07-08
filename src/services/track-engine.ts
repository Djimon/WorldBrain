// M12-S08: Track-Felder (markierte Slot-Arrays) — stub, implement in GREEN
// phase (#233). `slots` is a formula (M9 engine). `reset_on` names an
// M12-S04 transition trigger — the actual reset is that engine's job.

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
  _descriptor: TrackDescriptor,
  _entity: Record<string, number>,
): number | null {
  throw new Error('not implemented');
}

/** Marks `n` additional slots, clamped at the resolved cap, returning any newly-triggered flags. */
export function markTrack(
  _descriptor: TrackDescriptor,
  _currentMarked: number,
  _n: number,
  _entity: Record<string, number>,
): TrackMarkResult {
  throw new Error('not implemented');
}

/** Clears `n` marks, clamped at 0. */
export function clearTrack(_currentMarked: number, _n: number): number {
  throw new Error('not implemented');
}
