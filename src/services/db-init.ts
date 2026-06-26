import type { DatabaseLike } from './entity-service';
import { TauriSqlAdapter } from './tauri-sql-adapter';
import { applyCalendarSchema } from '../../core_data/calendar-schema';
import { applyCardSchema } from '../../core_data/card-schema';
import { applyEventSchema } from '../../core_data/event-schema';
import { applyHandoutSchema } from '../../core_data/handout-schema';
import { applyMapSchema } from '../../core_data/map-schema';
import { applyRelationsSchema } from '../../core_data/relations-schema';
import { applyRuleSchema } from '../../core_data/rule-schema';
import { applySavedViewsSchema } from '../../core_data/saved-views-schema';
import { applySearchSchema } from '../../core_data/search-schema';
import { applySessionSchema } from '../../core_data/session-schema';

// Schema helpers were typed against DatabaseSync.exec(). TauriSqlAdapter.exec() satisfies
// the runtime contract (fire-and-forget, serialized by SQLite). Cast through unknown.
type SchemaDb = Parameters<typeof applyCalendarSchema>[0];

export async function openProjectDb(dbPath: string): Promise<DatabaseLike> {
  const adapter = await TauriSqlAdapter.load(dbPath);
  const db = adapter as unknown as SchemaDb;

  await adapter.execute('PRAGMA journal_mode=WAL;');

  applyCalendarSchema(db);
  applyCardSchema(db as unknown as Parameters<typeof applyCardSchema>[0]);
  applyEventSchema(db as unknown as Parameters<typeof applyEventSchema>[0]);
  applyHandoutSchema(db as unknown as Parameters<typeof applyHandoutSchema>[0]);
  applyMapSchema(db as unknown as Parameters<typeof applyMapSchema>[0]);
  applySavedViewsSchema(db as unknown as Parameters<typeof applySavedViewsSchema>[0]);
  applySearchSchema(db as unknown as Parameters<typeof applySearchSchema>[0]);
  applySessionSchema(db as unknown as Parameters<typeof applySessionSchema>[0]);
  applyRelationsSchema(db as unknown as Parameters<typeof applyRelationsSchema>[0]);
  applyRuleSchema(adapter);

  // Drain all fire-and-forget schema exec() calls before returning.
  await adapter.flush();

  return adapter;
}
