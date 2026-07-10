import type { DatabaseLike } from './entity-service';

// Eras are named labels over an EXPLICIT date range (start .. end). They may
// overlap and may leave gaps — see core_data/calendar-schema.ts for resolvers.
export interface EraRow {
  id: string;
  calendar_id: string;
  name: string;
  /** Official year unit, e.g. "E.K."; falls back to `name` when empty. */
  abbr: string;
  start_year: number;
  start_month: number;
  start_day: number;
  end_year: number;
  end_month: number;
  end_day: number;
  year_number_at_start: number;
}

const COLUMNS = 'id, calendar_id, name, abbr, start_year, start_month, start_day, end_year, end_month, end_day, year_number_at_start';

export async function listEras(db: DatabaseLike, calendarId: string): Promise<EraRow[]> {
  return db.select<EraRow>(
    `SELECT ${COLUMNS} FROM eras WHERE calendar_id = ? ORDER BY start_year, start_month, start_day`,
    [calendarId],
  );
}

export async function saveEra(
  db: DatabaseLike,
  era: {
    id?: string; calendar_id: string; name: string; abbr?: string;
    start_year: number; start_month: number; start_day: number;
    end_year: number; end_month: number; end_day: number;
    year_number_at_start?: number;
  },
): Promise<string> {
  const id = era.id ?? `era-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT OR REPLACE INTO eras (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, era.calendar_id, era.name, era.abbr ?? '',
     era.start_year, era.start_month, era.start_day,
     era.end_year, era.end_month, era.end_day,
     era.year_number_at_start ?? 1],
  );
  return id;
}

export async function deleteEra(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM eras WHERE id = ?', [id]);
}
