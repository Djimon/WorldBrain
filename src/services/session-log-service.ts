// M8-S05: Session-Log (EPIC-013)
// Log entries persist in the session_log SQLite table (core_data schema). The
// fixed columns are id/session_id/action_type/created_at; the remaining entry
// fields (world_datetime, round, description, entity_id) live in payload_json.
import type { DatabaseLike } from './entity-service';

export interface LogEntry {
  id: string;
  session_id: string;
  real_timestamp: string;
  world_datetime: string;
  round: number | null;
  action_type: string;
  description: string;
  entity_id: string | null;
  // M8-S09: marks a session-scoped change as adopted into the base world
  // (see world-state-service isEntityChangeVisible, EPIC-013 M8-S04).
  world_change?: boolean;
}

interface LogPayload {
  world_datetime?: string;
  round?: number | null;
  description?: string;
  entity_id?: string | null;
  world_change?: boolean;
}

function parsePayload(raw: unknown): LogPayload {
  // JSON.parse of DB data → safe fallback (AP-006 exception).
  try {
    return JSON.parse(String(raw ?? '{}')) as LogPayload;
  } catch {
    return {};
  }
}

export async function listLogEntries(db: DatabaseLike, opts: { sessionId: string }): Promise<LogEntry[]> {
  const rows = await db.select<Record<string, unknown>>(
    'SELECT id, session_id, action_type, payload_json, created_at FROM session_log WHERE session_id = ? ORDER BY created_at ASC',
    [opts.sessionId],
  );
  return rows.map((row) => {
    const payload = parsePayload(row.payload_json);
    return {
      id: String(row.id),
      session_id: String(row.session_id),
      real_timestamp: String(row.created_at),
      world_datetime: String(payload.world_datetime ?? ''),
      round: payload.round ?? null,
      action_type: String(row.action_type),
      description: String(payload.description ?? ''),
      entity_id: payload.entity_id ?? null,
      world_change: payload.world_change ?? false,
    };
  });
}

export async function addLogEntry(db: DatabaseLike, entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
  const id = `log_${crypto.randomUUID()}`;
  const payload: LogPayload = {
    world_datetime: entry.world_datetime,
    round: entry.round,
    description: entry.description,
    entity_id: entry.entity_id,
    world_change: entry.world_change,
  };
  await db.execute(
    'INSERT INTO session_log (id, session_id, action_type, payload_json, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, entry.session_id, entry.action_type, JSON.stringify(payload), entry.real_timestamp],
  );
  return { id, ...entry };
}
