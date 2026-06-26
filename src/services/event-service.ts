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

export async function createEvent(db: DatabaseLike, params: CreateEventParams): Promise<{ id: string }> {
  const id = generateId();
  await db.execute(
    `INSERT INTO events (id, title, type, start_day, end_day, precision, visibility, participants_json, locations_json, variable_triggers_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, params.title, params.type, params.start_day, params.end_day ?? null, params.precision, params.visibility,
     JSON.stringify(params.participants), JSON.stringify(params.locations), JSON.stringify(params.variable_triggers ?? [])],
  );
  return { id };
}

export async function getEvent(db: DatabaseLike, id: string): Promise<EventRow | null> {
  const rows = await db.select<Record<string, unknown>>('SELECT * FROM events WHERE id = ?', [id]);
  const row = rows[0];
  if (!row) return null;
  return parseEventRow(row);
}

export async function listEvents(db: DatabaseLike, options: { type?: string; participantId?: string; locationId?: string }): Promise<EventRow[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options.type) { conditions.push('type = ?'); params.push(options.type); }
  if (options.participantId) { conditions.push('participants_json LIKE ?'); params.push(`%"${options.participantId}"%`); }
  if (options.locationId) { conditions.push('locations_json LIKE ?'); params.push(`%"${options.locationId}"%`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = await db.select<Record<string, unknown>>(
    `SELECT * FROM events ${where} ORDER BY start_day ASC`,
    params,
  );
  return rows.map(parseEventRow);
}

export async function updateEvent(db: DatabaseLike, id: string, patch: Partial<CreateEventParams>): Promise<void> {
  if (patch.title !== undefined) await db.execute('UPDATE events SET title = ? WHERE id = ?', [patch.title, id]);
  if (patch.type !== undefined) await db.execute('UPDATE events SET type = ? WHERE id = ?', [patch.type, id]);
  if (patch.start_day !== undefined) await db.execute('UPDATE events SET start_day = ? WHERE id = ?', [patch.start_day, id]);
  if (patch.end_day !== undefined) await db.execute('UPDATE events SET end_day = ? WHERE id = ?', [patch.end_day, id]);
  if (patch.visibility !== undefined) await db.execute('UPDATE events SET visibility = ? WHERE id = ?', [patch.visibility, id]);
  if (patch.participants !== undefined) await db.execute('UPDATE events SET participants_json = ? WHERE id = ?', [JSON.stringify(patch.participants), id]);
  if (patch.locations !== undefined) await db.execute('UPDATE events SET locations_json = ? WHERE id = ?', [JSON.stringify(patch.locations), id]);
}
