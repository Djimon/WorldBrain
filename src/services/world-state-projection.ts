// M14-S10: Derived World-State-Projektion (#265)
// Pure fold over all effect assertions (properties.effects across every
// Event entity) with day <= D, last-wins per target (Decision 1 — derived,
// never mutating/firing). Same-day ties break by event created_at, then
// effect index within that event, both ascending (deterministic).
import type { DatabaseLike } from './entity-service';

/**
 * Folds every effect assertion with day <= `day` (across all Event
 * entities) into a Map<target, value>: set/set_flag overwrite, gain/spend
 * accumulate numerically, clear removes the target from the map.
 */
export async function worldStateAt(_db: DatabaseLike, _day: number): Promise<Map<string, unknown>> {
  throw new Error('not implemented');
}

/** The last `set` assertion on `entity:<entityId>#status` with day <= `day`, or undefined. */
export async function entityStatusAt(
  _db: DatabaseLike,
  _entityId: string,
  _day: number,
): Promise<unknown | undefined> {
  throw new Error('not implemented');
}
