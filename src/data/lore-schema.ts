// Lore-Entity: eigenständige undatierte Lore (#271)
// D1: exactly one `Lore` entity type + properties.lore_kind — a soft,
// DM-extensible string (never a DB enum). Seed suggestions only, mirroring
// event_kind (EPIC-021) and category (M14-S15, #272) — same pattern, no new
// mechanism (D2).
export const LORE_KIND_SUGGESTIONS = [
  'story', 'backstory', 'readout', 'secret', 'prophecy', 'rumor', 'legend', 'history',
] as const;
