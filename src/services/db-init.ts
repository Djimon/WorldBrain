import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from './entity-service';
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

// DatabaseSync satisfies all schema function signatures at runtime.
// The SQLInputValue vs unknown variance in @types/node prevents structural assignability,
// so we cast once through unknown to apply schemas, then return as DatabaseLike.
export function openProjectDb(dbPath: string): DatabaseLike {
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA journal_mode=WAL;');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = raw as unknown as any;
  applyCalendarSchema(db);
  applyCardSchema(db);
  applyEventSchema(db);
  applyHandoutSchema(db);
  applyMapSchema(db);
  applyRelationsSchema(db);
  applyRuleSchema(db);
  applySavedViewsSchema(db);
  applySearchSchema(db);
  applySessionSchema(db);
  return db as DatabaseLike;
}
