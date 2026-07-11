// M14-S04: Event-Entity-Modell & Ablösung der events-Tabelle (#259)
// Replaces event-service.ts / event-schema.ts (EPIC-021 Decision 1): an
// Event is a base_entities row with type='Event'. Event-specific data lives
// in properties: event_kind, start_day (may be negative), end_day (phase
// only), effects (always [] in β).
import type { DatabaseLike } from './entity-service';

export type EventKind = 'single' | 'phase';

// M14-S15 (#272): thematic, optional, DM-extensible — not a hard enum. These
// are seed suggestions for the form/Chronicle filter, not a closed set.
export const EVENT_CATEGORY_SUGGESTIONS = [
  'battle', 'politics', 'disaster', 'discovery', 'ritual', 'investigation', 'social', 'death',
] as const;

export interface CreateEventEntityParams {
  title: string;
  start_day: number;
  event_kind: EventKind;
  end_day?: number;
  category?: string;
}

export interface EventEntitySummary {
  id: string;
  title: string;
  start_day: number;
  end_day?: number;
  event_kind: EventKind;
  category?: string;
}

interface EventProperties {
  event_kind: EventKind;
  start_day: number;
  end_day?: number;
  effects: unknown[];
}

// AP-006 exception: JSON.parse of DB-stored properties_json → safe fallback.
function parseEventProperties(propertiesJson: string): EventProperties {
  try {
    const parsed = JSON.parse(propertiesJson) as Partial<EventProperties>;
    return {
      event_kind: parsed.event_kind === 'phase' ? 'phase' : 'single',
      start_day: typeof parsed.start_day === 'number' ? parsed.start_day : 0,
      end_day: typeof parsed.end_day === 'number' ? parsed.end_day : undefined,
      effects: Array.isArray(parsed.effects) ? parsed.effects : [],
    };
  } catch {
    return { event_kind: 'single', start_day: 0, effects: [] };
  }
}

function toProperties(params: { start_day: number; event_kind: EventKind; end_day?: number }): EventProperties {
  const properties: EventProperties = { event_kind: params.event_kind, start_day: params.start_day, effects: [] };
  if (params.event_kind === 'phase' && params.end_day !== undefined) properties.end_day = params.end_day;
  return properties;
}

function toSummary(row: { id: string; title: string; properties_json: string }): EventEntitySummary {
  const properties = parseEventProperties(row.properties_json);
  return {
    id: row.id,
    title: row.title,
    start_day: properties.start_day,
    end_day: properties.end_day,
    event_kind: properties.event_kind,
  };
}

export async function createEventEntity(
  db: DatabaseLike,
  params: CreateEventEntityParams,
): Promise<{ id: string }> {
  const id = `event-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString();
  const properties = toProperties(params);
  await db.execute(
    `INSERT INTO base_entities (id, type, title, summary, properties_json, aliases_json, body_json, visibility, created_at, updated_at)
     VALUES (?, 'Event', ?, '', ?, '[]', '{"format":"portable_blocks_v1","blocks":[]}', 'public', ?, ?)`,
    [id, params.title, JSON.stringify(properties), now, now],
  );
  return { id };
}

export async function listEventEntities(db: DatabaseLike): Promise<EventEntitySummary[]> {
  const rows = await db.select<{ id: string; title: string; properties_json: string }>(
    `SELECT id, title, properties_json FROM base_entities WHERE type = 'Event'`,
  );
  return rows.map(toSummary);
}

export async function getEventEntity(db: DatabaseLike, id: string): Promise<EventEntitySummary | null> {
  const rows = await db.select<{ id: string; title: string; properties_json: string }>(
    `SELECT id, title, properties_json FROM base_entities WHERE id = ? AND type = 'Event'`,
    [id],
  );
  const row = rows[0];
  return row ? toSummary(row) : null;
}

export async function updateEventEntity(
  db: DatabaseLike,
  id: string,
  patch: Partial<CreateEventEntityParams>,
): Promise<void> {
  const existing = await getEventEntity(db, id);
  if (!existing) return;
  const merged = { ...existing, ...patch };
  const properties = toProperties(merged);
  await db.execute(
    `UPDATE base_entities SET title = ?, properties_json = ?, updated_at = ? WHERE id = ?`,
    [merged.title, JSON.stringify(properties), new Date().toISOString(), id],
  );
}
