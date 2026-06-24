import type { DatabaseLike } from './entity-service';

export function saveCalendar(_db: DatabaseLike, _data: unknown): { id: string } {
  return { id: crypto.randomUUID() };
}

export function importCalendarFromJson(json: string): unknown {
  return JSON.parse(json);
}

export function formatAbsoluteDay(day: number): string {
  return `Day ${day}`;
}
