// M14-S10: Derived World-State-Projektion (#265)
// Pure fold over all effect assertions (properties.effects across every
// Event entity) with day <= D, last-wins per target (Decision 1 — derived,
// never mutating/firing). Same-day ties break by event created_at, then
// effect index within that event, both ascending (deterministic).
import type { DatabaseLike } from './entity-service';

interface RawEffect {
  day: number;
  target: string;
  verb: string;
  value?: unknown;
}

interface EventRow {
  id: string;
  properties_json: string;
  created_at: string;
}

interface AssertionEntry {
  day: number;
  target: string;
  verb: string;
  value: unknown;
  createdAt: string;
  effectIndex: number;
}

// AP-006 exception: JSON.parse of DB-stored properties_json → safe fallback.
function parseEffects(propertiesJson: string): RawEffect[] {
  try {
    const parsed = JSON.parse(propertiesJson) as { effects?: RawEffect[] };
    return Array.isArray(parsed.effects) ? parsed.effects : [];
  } catch {
    return [];
  }
}

async function collectAssertions(db: DatabaseLike, day: number): Promise<AssertionEntry[]> {
  const rows = await db.select<EventRow>(
    `SELECT id, properties_json, created_at FROM base_entities WHERE type = 'Event'`,
  );
  const entries: AssertionEntry[] = [];
  for (const row of rows) {
    parseEffects(row.properties_json).forEach((effect, effectIndex) => {
      if (effect.day <= day) {
        entries.push({ day: effect.day, target: effect.target, verb: effect.verb, value: effect.value, createdAt: row.created_at, effectIndex });
      }
    });
  }
  entries.sort((a, b) => {
    if (a.day !== b.day) return a.day - b.day;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
    return a.effectIndex - b.effectIndex;
  });
  return entries;
}

/**
 * Folds every effect assertion with day <= `day` (across all Event
 * entities) into a Map<target, value>: set/set_flag overwrite, gain/spend
 * accumulate numerically, clear removes the target from the map.
 */
export async function worldStateAt(db: DatabaseLike, day: number): Promise<Map<string, unknown>> {
  const entries = await collectAssertions(db, day);
  const state = new Map<string, unknown>();
  for (const entry of entries) {
    switch (entry.verb) {
      case 'set':
        state.set(entry.target, entry.value);
        break;
      case 'set_flag':
        state.set(entry.target, entry.value ?? true);
        break;
      case 'gain':
        state.set(entry.target, Number(state.get(entry.target) ?? 0) + Number(entry.value));
        break;
      case 'spend':
        state.set(entry.target, Number(state.get(entry.target) ?? 0) - Number(entry.value));
        break;
      case 'clear':
        state.delete(entry.target);
        break;
    }
  }
  return state;
}

/** The last `set` assertion on `entity:<entityId>#status` with day <= `day`, or undefined. */
export async function entityStatusAt(
  db: DatabaseLike,
  entityId: string,
  day: number,
): Promise<unknown | undefined> {
  const state = await worldStateAt(db, day);
  return state.get(`entity:${entityId}#status`);
}
