import type { DatabaseLike } from './entity-service';

export interface CreateEventParams {
  title: string;
  type: string;
  start_day: number;
  end_day?: number;
  precision: string;
  visibility: string;
  participants: string[];
  locations: string[];
  variable_triggers?: unknown[];
}

export interface EventRow {
  id: string;
  title: string;
  type: string;
  start_day: number;
  end_day: number | null;
  precision: string;
  visibility: string;
  participants: string[];
  locations: string[];
  variable_triggers: unknown[];
}

function generateId(): string {
  return 'ev_' + crypto.randomUUID();
}

export function createEvent(db: DatabaseLike, params: CreateEventParams): { id: string } {
  const id = generateId();
  db.prepare(
    `INSERT INTO events (id, title, type, start_day, end_day, precision, visibility, participants_json, locations_json, variable_triggers_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    params.title,
    params.type,
    params.start_day,
    params.end_day ?? null,
    params.precision,
    params.visibility,
    JSON.stringify(params.participants),
    JSON.stringify(params.locations),
    JSON.stringify(params.variable_triggers ?? [])
  );
  return { id };
}

export function getEvent(db: DatabaseLike, id: string): EventRow | null {
  const row = db.prepare('SELECT * FROM events WHERE id = ?').get(id) as Record<string, unknown> | null | undefined;
  if (!row) return null;
  return parseEventRow(row);
}

export function listEvents(db: DatabaseLike, options: { type?: string; participantId?: string; locationId?: string }): EventRow[] {
  const rows = db.prepare('SELECT * FROM events ORDER BY start_day ASC').all() as Array<Record<string, unknown>>;
  let events = rows.map(parseEventRow);

  if (options.type) {
    events = events.filter(e => e.type === options.type);
  }
  if (options.participantId) {
    events = events.filter(e => e.participants.includes(options.participantId!));
  }
  if (options.locationId) {
    events = events.filter(e => e.locations.includes(options.locationId!));
  }
  return events;
}

export function updateEvent(db: DatabaseLike, id: string, patch: Partial<CreateEventParams>): void {
  if (patch.title !== undefined) db.prepare('UPDATE events SET title = ? WHERE id = ?').run(patch.title, id);
  if (patch.type !== undefined) db.prepare('UPDATE events SET type = ? WHERE id = ?').run(patch.type, id);
}

function parseEventRow(row: Record<string, unknown>): EventRow {
  return {
    id: String(row.id),
    title: String(row.title),
    type: String(row.type),
    start_day: Number(row.start_day),
    end_day: row.end_day != null ? Number(row.end_day) : null,
    precision: String(row.precision),
    visibility: String(row.visibility),
    participants: JSON.parse(String(row.participants_json ?? '[]')),
    locations: JSON.parse(String(row.locations_json ?? '[]')),
    variable_triggers: JSON.parse(String(row.variable_triggers_json ?? '[]')),
  };
}
