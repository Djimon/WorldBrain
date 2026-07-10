import type { DatabaseLike } from './entity-service';

// M13 calendar-timelines S3: eras are named labels over contiguous global-year
// ranges (see core_data/calendar-schema.ts for the resolver functions).
export interface EraRow {
  id: string;
  calendar_id: string;
  name: string;
  start_year: number;
  year_number_at_start: number;
}

export async function listEras(db: DatabaseLike, calendarId: string): Promise<EraRow[]> {
  return db.select<EraRow>(
    'SELECT id, calendar_id, name, start_year, year_number_at_start FROM eras WHERE calendar_id = ? ORDER BY start_year',
    [calendarId],
  );
}

export async function saveEra(
  db: DatabaseLike,
  era: { id?: string; calendar_id: string; name: string; start_year: number; year_number_at_start?: number },
): Promise<string> {
  const id = era.id ?? `era-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  await db.execute(
    `INSERT OR REPLACE INTO eras (id, calendar_id, name, start_year, year_number_at_start)
     VALUES (?, ?, ?, ?, ?)`,
    [id, era.calendar_id, era.name, era.start_year, era.year_number_at_start ?? 1],
  );
  return id;
}

export async function deleteEra(db: DatabaseLike, id: string): Promise<void> {
  await db.execute('DELETE FROM eras WHERE id = ?', [id]);
}
