# EPIC-025: Relations + Verlinkungen Graph

Milestone: **M15 - Play & Presentation Tools** (GitHub #18). Area: `area: search` (knowledge views).
Extends the verified relations graph (EPIC-004) — an additive layer, **not** a rebuild.

## Goal

A global, Obsidian-style graph of the whole world showing **both** connection kinds together,
visually distinct: the deliberate typed `relations` (solid) **and** the `@[Name](id)` inline
mentions/Verlinkungen embedded in entity text (dashed). Surfaces emergent structure — clusters
you never formally declared, only mentioned.

## Substrate reality (verified 2026-07-11 — build on this, do not rebuild)

- **`src/ui/GlobalEntityGraph.tsx` already renders the global RELATIONS graph:** all entities as nodes
  (`listEntitiesByType({type:null})`), all `relations` as edges (`getAllRelations`), filters by entity
  type + relation type, Cytoscape `cose` layout, click node → `onNavigate`. This is the "left picture", global.
- **`src/ui/EntityGraph.tsx`** = the per-entity ego graph (EPIC-004, M2-S13). Unchanged by this epic.
- **Verlinkungen already exist as a feature:** mentions are stored inline as **`@[Name](id)`** in `summary`
  and properties; `parseMentions` (exported from `src/ui/PropertiesForm.tsx`) parses them; `BacklinksTab.tsx`
  already lists inbound mentions ("Keine Verlinkungen." is a shipped string). NOT `[[wikilink]]` syntax.
- **What is missing for the "right picture"** (the whole of this epic): extract mention edges across all
  entities, merge them into `GlobalEntityGraph` as a second, visually-distinct edge source, with a toggle.

## Scope

- Extract `@[Name](id)` mentions across all entities → deduplicated directed edges (source → mentioned).
- Merge mention edges into `GlobalEntityGraph` alongside relation edges.
- Visual distinction: relations = solid edges, Verlinkungen = dashed edges.
- Node color by entity type; a toggle to show/hide Verlinkungen edges.
- Fix the current graph's hardcoded English strings (i18n) and add minimal edge/node styling.

## Out Of Scope

- The per-entity ego graph (`EntityGraph.tsx`) — unchanged.
- Graph analytics (centrality, shortest path, clustering metrics).
- Editing relations/mentions from the graph (read + navigate only).
- New mention syntax or a mention-authoring feature (the `@[Name](id)` system already exists).
- A separate mention-edges DB table — edges are derived on read from entity text, not persisted.

## Decisions

- **D1 — Two edge sources, one graph, visually distinct.** Solid = `relations` (typed); dashed = mentions
  (`@[Name](id)`, untyped). Both filterable; a toggle shows/hides the mention (Verlinkung) layer.
- **D2 — Mentions are derived on read, not stored as edges.** Reuse `parseMentions` over each entity's
  scanned text; build edges in memory. No new table, no persistence, no sync (single source of truth = the text).
- **D3 — Scan every place a mention can appear:** `summary`, every value in `properties_json`, and the
  `body` (`portable_blocks_v1`) if the editor writes mentions there. (Impl verifies whether `body_json`
  contains `@[Name](id)`; today `BacklinksTab` scans only summary + properties — extend if body carries them.)
- **D4 — Directed, deduplicated edges.** One edge per (source, target) pair regardless of mention count;
  direction = mentioning entity → mentioned entity. Self-mentions dropped. A mention to a non-existent id dropped.
- **D5 — Build on `GlobalEntityGraph`, keep its type filters.** Extend it; do not fork a parallel component.

## Stories

| Story | Type | Kern |
|---|---|---|
| M15-S17 | story | Mention-edge extraction: `buildMentionEdges(entities)` reusing `parseMentions` over summary + properties + body; deduped directed edges; drops self/dangling |
| M15-S18 | story | `GlobalEntityGraph` = Relations + Verlinkungen: merge both edge sources, solid vs dashed styling, node color by type, toggle "Verlinkungen an/aus", all strings i18n |
| M15-S19 | story (optional) | Politur: layout/reset controls, legend (solid=Relation / dashed=Verlinkung), hooked into app navigation as a knowledge view |

**Dependency axis:** S17 → S18 → (S19). S17 is a pure function (easy TDD). S18 does the Cytoscape merge + UI.

## Constraints propagated into every Story AC (verbatim)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts.
- AP-006: No `try/catch` around DB operations; errors propagate. (Exception: `JSON.parse` of `properties_json`/`body_json` → safe fallback, as `parseMentions`/`BacklinksTab` already do.)
- AP-008 (service gate): No `if (database)`/`if (service)` guard before service calls; optional props passed through.
- UI story (S18/S19): AP-003 (no `prompt`/`alert`/`confirm`); AP-008 RTL (anchored queries; the graph's type/toggle checkboxes must be uniquely queryable); no hardcoded UI strings (`useTranslation` + inline German default — replaces the current hardcoded "Entity Types"/"Relation Types"); ≥1 `.dom.test.tsx`.
- Test files: ESM `import` only, no `require()` (AP-005).

## Open Decisions

- None blocking. (Body-mention scan is a verify-during-impl detail, D3.)

## Sources

- EPIC-004 `planning/epics/M2-relations-knowledge-graph.md` (relations + ego graph, verified).
- Existing: `src/ui/GlobalEntityGraph.tsx`, `src/ui/EntityGraph.tsx`, `src/ui/PropertiesForm.tsx` (`parseMentions`), `src/ui/BacklinksTab.tsx`.
- Interview 2026-07-11 (Requirement Agent). Requirement = "Relations + Links" (Todos.txt), i.e. both edge sources.
