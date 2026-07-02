// M8-S04: Cross-Session World State (EPIC-013)
// A world event that happened at world-time T is visible to any session whose
// calendar_position has reached or passed T. Pure predicates, no HTML output.

export interface WorldStateSession {
  id?: string;
  calendar_position: number;
}

export interface ChronicleEntry {
  id?: string;
  world_datetime: number;
  description?: string;
  world_change?: boolean;
}

export interface EntityChange {
  entity_id: string;
  world_datetime: number;
  world_change: boolean;
  new_status?: string;
  session_id?: string;
}

export interface ItemChange {
  item_id: string;
  unique: boolean;
  world_datetime: number;
}

/** Chronicle entry is visible once the session's world time has reached it. */
export function isEntryVisibleInSession(params: { entry: ChronicleEntry; session: WorldStateSession }): boolean {
  return params.entry.world_datetime <= params.session.calendar_position;
}

/** Entity state change crosses sessions only when explicitly marked world_change. */
export function isEntityChangeVisible(params: { change: EntityChange; session: WorldStateSession }): boolean {
  return params.change.world_change === true && params.change.world_datetime <= params.session.calendar_position;
}

/** Item transfer crosses sessions only for unique items. */
export function isItemChangeVisible(params: { change: ItemChange; session: WorldStateSession }): boolean {
  return params.change.unique === true && params.change.world_datetime <= params.session.calendar_position;
}

/**
 * Conflicting world changes are contradictory states for the same entity.
 * No auto-resolution: every change involved in a conflict is returned so the GM
 * can decide. (EPIC-013 decision 4.)
 */
export function getConflictingWorldChanges(changes: EntityChange[]): EntityChange[] {
  const worldChanges = changes.filter((c) => c.world_change === true);
  const byEntity = new Map<string, EntityChange[]>();
  for (const change of worldChanges) {
    const group = byEntity.get(change.entity_id) ?? [];
    group.push(change);
    byEntity.set(change.entity_id, group);
  }
  const conflicts: EntityChange[] = [];
  for (const group of byEntity.values()) {
    const distinctStatuses = new Set(group.map((c) => c.new_status));
    if (group.length > 1 && distinctStatuses.size > 1) {
      conflicts.push(...group);
    }
  }
  return conflicts;
}
