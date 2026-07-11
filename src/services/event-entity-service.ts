// M14-S04: Event-Entity-Modell & Ablösung der events-Tabelle (#259)
// Replaces event-service.ts / event-schema.ts (EPIC-021 Decision 1): an
// Event is a base_entities row with type='Event'. Event-specific data lives
// in properties: event_kind, start_day (may be negative), end_day (phase
// only), effects (always [] in β).
import type { DatabaseLike } from './entity-service';

export type EventKind = 'single' | 'phase';

export interface CreateEventEntityParams {
  title: string;
  start_day: number;
  event_kind: EventKind;
  end_day?: number;
}

export interface EventEntitySummary {
  id: string;
  title: string;
  start_day: number;
  end_day?: number;
  event_kind: EventKind;
}

export async function createEventEntity(
  _db: DatabaseLike,
  _params: CreateEventEntityParams,
): Promise<{ id: string }> {
  throw new Error('not implemented');
}

export async function listEventEntities(_db: DatabaseLike): Promise<EventEntitySummary[]> {
  throw new Error('not implemented');
}

export async function getEventEntity(_db: DatabaseLike, _id: string): Promise<EventEntitySummary | null> {
  throw new Error('not implemented');
}

export async function updateEventEntity(
  _db: DatabaseLike,
  _id: string,
  _patch: Partial<CreateEventEntityParams>,
): Promise<void> {
  throw new Error('not implemented');
}
