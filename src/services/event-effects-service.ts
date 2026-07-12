// M14-S09: Effekt-Assertions am Event speichern (#264)
// properties.effects carries the S08 Effect list ({day,target,verb,value?}).
// Validates against the shared S08 vocabulary (effect-vocabulary.ts) before
// persisting — invalid target/verb is rejected, never silently stored.
import type { DatabaseLike } from './entity-service';
import type { Effect } from './effect-vocabulary';

export interface EffectInput {
  day?: number;
  target: string;
  verb: string;
  value?: unknown;
}

/**
 * Adds an effect assertion to an Event entity's properties.effects.
 * `day` defaults to the event's own `start_day` when omitted. Validates the
 * target (S08 parseTarget) and verb (S08 validateEffectVerb) before writing
 * — an invalid effect is rejected and never persisted.
 */
export async function addEffect(_db: DatabaseLike, _eventId: string, _effect: EffectInput): Promise<void> {
  throw new Error('not implemented');
}

/** Updates the effect at `index` in the Event's effects list, re-validating the merged result. */
export async function updateEffect(
  _db: DatabaseLike,
  _eventId: string,
  _index: number,
  _patch: Partial<EffectInput>,
): Promise<void> {
  throw new Error('not implemented');
}

/** Removes the effect at `index` from the Event's effects list. */
export async function removeEffect(_db: DatabaseLike, _eventId: string, _index: number): Promise<void> {
  throw new Error('not implemented');
}

/** Reads the current effects list of an Event entity (JSON.parse fallback, AP-006 exception). */
export async function listEffects(_db: DatabaseLike, _eventId: string): Promise<Effect[]> {
  throw new Error('not implemented');
}
