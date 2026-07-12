// M14-S09: Effekt-Assertions am Event speichern (#264)
// properties.effects carries the S08 Effect list ({day,target,verb,value?}).
// Validates against the shared S08 vocabulary (effect-vocabulary.ts) before
// persisting — invalid target/verb is rejected, never silently stored.
import type { DatabaseLike } from './entity-service';
import { parseTarget, validateEffectVerb, type Effect, type EffectVerb } from './effect-vocabulary';

export interface EffectInput {
  day?: number;
  target: string;
  verb: string;
  value?: unknown;
}

interface EventProperties {
  event_kind: 'single' | 'phase';
  start_day: number;
  end_day?: number;
  effects: Effect[];
}

// AP-006 exception: JSON.parse of DB-stored properties_json → safe fallback.
function parseEventProperties(propertiesJson: string): EventProperties {
  try {
    const parsed = JSON.parse(propertiesJson) as Partial<EventProperties>;
    return {
      event_kind: parsed.event_kind === 'phase' ? 'phase' : 'single',
      start_day: typeof parsed.start_day === 'number' ? parsed.start_day : 0,
      end_day: typeof parsed.end_day === 'number' ? parsed.end_day : undefined,
      effects: Array.isArray(parsed.effects) ? (parsed.effects as Effect[]) : [],
    };
  } catch {
    return { event_kind: 'single', start_day: 0, effects: [] };
  }
}

async function readEventProperties(db: DatabaseLike, eventId: string): Promise<EventProperties | null> {
  const rows = await db.select<{ properties_json: string }>(
    `SELECT properties_json FROM base_entities WHERE id = ? AND type = 'Event'`,
    [eventId],
  );
  const row = rows[0];
  return row ? parseEventProperties(row.properties_json) : null;
}

async function writeEffects(db: DatabaseLike, eventId: string, properties: EventProperties, effects: Effect[]): Promise<void> {
  await db.execute(`UPDATE base_entities SET properties_json = ? WHERE id = ?`, [
    JSON.stringify({ ...properties, effects }),
    eventId,
  ]);
}

/** Validates an effect's target/verb against the shared S08 vocabulary — throws on invalid input. */
function validateEffect(effect: { target: string; verb: string }): void {
  parseTarget(effect.target);
  validateEffectVerb(effect.verb);
}

function toEffect(input: EffectInput, defaultDay: number): Effect {
  const effect: Effect = { day: input.day ?? defaultDay, target: input.target, verb: input.verb as EffectVerb };
  if (input.value !== undefined) effect.value = input.value;
  return effect;
}

/**
 * Adds an effect assertion to an Event entity's properties.effects.
 * `day` defaults to the event's own `start_day` when omitted. Validates the
 * target (S08 parseTarget) and verb (S08 validateEffectVerb) before writing
 * — an invalid effect is rejected and never persisted.
 */
export async function addEffect(db: DatabaseLike, eventId: string, effect: EffectInput): Promise<void> {
  validateEffect(effect);
  const properties = await readEventProperties(db, eventId);
  if (!properties) return;
  const newEffect = toEffect(effect, properties.start_day);
  await writeEffects(db, eventId, properties, [...properties.effects, newEffect]);
}

/** Updates the effect at `index` in the Event's effects list, re-validating the merged result. */
export async function updateEffect(
  db: DatabaseLike,
  eventId: string,
  index: number,
  patch: Partial<EffectInput>,
): Promise<void> {
  const properties = await readEventProperties(db, eventId);
  if (!properties) return;
  const existing = properties.effects[index];
  if (!existing) return;
  const merged: Effect = { ...existing, ...patch, verb: (patch.verb ?? existing.verb) as EffectVerb };
  validateEffect(merged);
  const effects = properties.effects.map((e, i) => (i === index ? merged : e));
  await writeEffects(db, eventId, properties, effects);
}

/** Removes the effect at `index` from the Event's effects list. */
export async function removeEffect(db: DatabaseLike, eventId: string, index: number): Promise<void> {
  const properties = await readEventProperties(db, eventId);
  if (!properties) return;
  const effects = properties.effects.filter((_, i) => i !== index);
  await writeEffects(db, eventId, properties, effects);
}

/** Reads the current effects list of an Event entity (JSON.parse fallback, AP-006 exception). */
export async function listEffects(db: DatabaseLike, eventId: string): Promise<Effect[]> {
  const properties = await readEventProperties(db, eventId);
  return properties ? properties.effects : [];
}
