// M8-S05: Session-Log — stub, implement in GREEN phase
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
}

export async function listLogEntries(_db: DatabaseLike, _opts: { sessionId: string }): Promise<LogEntry[]> {
  throw new Error('not implemented');
}

export async function addLogEntry(_db: DatabaseLike, _entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
  throw new Error('not implemented');
}
