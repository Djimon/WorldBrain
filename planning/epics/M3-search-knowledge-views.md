# EPIC-005: Search & Knowledge Views

## Goal

Make project knowledge findable and usable through search and structured views.

## Scope

- SQLite FTS5 full-text search with substring fallback.
- Global search UX with facets and metadata compensation.
- Table view with filter, sort, and inline-edit.
- Saved views.
- Wiki/Text clean reading view (presentation mode, no editor chrome).
- Global filtered graph view (not entity-centered).

## Out Of Scope

- Elasticsearch, OpenSearch, Meilisearch, Typesense.
- Board view (later Epic).
- Map view (EPIC-008).
- Timeline view (EPIC-007).
- Cards view (EPIC-009).

## Decisions

- **Search implementation:** SQLite FTS5 for full-text (title, aliases, summary, body, tags, properties). Substring matching via `LIKE '%query%'` as fallback for prefix and suffix queries (`sila*` finds "Silas", `*silva` finds "da Silva"). No extra process — all local SQLite. Typo-tolerance is not V1.
- **Table view:** Filter, sort, and inline-edit are all V1-required. Read-only is not sufficient.
- **Wiki/Text View:** Clean reading mode for entity body — full-width, no editor chrome, no properties form. Distinct from EPIC-003 entity detail view (edit mode). Used for presenting/reading an entity like a wiki article.
- **Global graph view:** A filtered graph not centered on one entity. User selects entity types and/or relation types to show globally (e.g. "all Faction–enemy_of–Faction edges"). Distinct from EPIC-004 local graph (which is always centered on one entity). Uses Cytoscape.js.
- **Saved views:** Persist filter + column + sort configuration for Table and Graph views. Schema stored as JSON in SQLite.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| M3-S01: FTS5 search index setup | Verified | #42 — core_data/search-schema.ts: FTS5 virtual table, indexEntity, rebuildSearchIndex, removeEntityFromIndex. |
| M3-S02: Search service layer | Verified | #43 — src/services/search-service.ts: searchEntities (FTS5+LIKE fallback), getSearchFacets. |
| M3-S03: Global search UX | Verified | #44 — src/ui/GlobalSearch.tsx: live search, facet sidebar buttons, keyboard nav (↓/Enter/Esc). |
| M3-S04: Table view | Verified | #45 — src/ui/EntityTable.tsx: column picker, sort, title filter, inline edit via select. |
| M3-S05: Saved views | Verified | #46 — core_data/saved-views-schema.ts + src/services/saved-views-service.ts: saveView/listViews/loadView/renameView/deleteView. |
| M3-S06: Wiki/Text reading view | Verified | #47 — src/ui/EntityReadingView.tsx: read-only block render, edit toggle, back button. |
| M3-S07: Global filtered graph view | Verified | #48 — src/ui/GlobalEntityGraph.tsx: Cytoscape static import, entity+relation type checkboxes, initialConfig/onConfigChange. |

## Sources

- `worldbuilding_architecture_study/05_Search_Knowledge_Views.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
