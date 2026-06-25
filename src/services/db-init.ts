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

export function openProjectDb(dbPath: string): DatabaseLike {
  const raw = new DatabaseSync(dbPath);
  raw.exec('PRAGMA journal_mode=WAL;');

  // Schemas expecting InstanceType<typeof DatabaseSync> — pass raw directly.
  applyCalendarSchema(raw);
  applyCardSchema(raw);
  applyEventSchema(raw);
  applyHandoutSchema(raw);
  applyMapSchema(raw);
  applySavedViewsSchema(raw);
  applySearchSchema(raw);
  applySessionSchema(raw);

  // RelationsDb uses run(...args: unknown[]) while DatabaseSync uses SQLInputValue[].
  // The constraint difference is a @types/node variance artifact; runtime behaviour is
  // identical — cast through unknown (not any) to satisfy the type checker.
  applyRelationsSchema(raw as unknown as Parameters<typeof applyRelationsSchema>[0]);
  applyRuleSchema(raw as unknown as DatabaseLike);

  return raw as unknown as DatabaseLike;
}
