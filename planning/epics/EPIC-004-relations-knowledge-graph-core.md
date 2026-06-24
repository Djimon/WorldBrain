# EPIC-004: Relations & Knowledge Graph Core

## Goal

Represent relations as first-class data and expose them through reusable relation tooling.

## Scope

- Typed edge table with active flag, visibility, and optional notes.
- Campaign session log for relation add/remove events.
- Relation type registry with inverse labels and symmetry.
- Entity picker component.
- Relations tab on entity detail view.
- Local graph view per entity.

## Out Of Scope

- Neo4j or external graph database.
- Advanced graph analytics.
- Multi-user relationship workflows.
- Time ranges on relations (temporal tracking via session log only).

## Decisions

- **Relation notes:** Optional free-text notes on a relation. Not forced. Stored as base data on the relation itself.
- **Relation visibility:** Relations support `gm_only` visibility. A secret connection between two visible entities can be hidden from players.
- **Relation lifecycle:** Relations are never hard-deleted. Removing a relation sets `active = false` and records a session log entry. Reactivating sets `active = true` and logs again. Notes are preserved across deactivation/reactivation.
- **Session log:** `campaign_relation_log` table records `relation.added` / `relation.removed` events with session reference. Bidirectional — both directions are logged. The relation itself has no internal memory; the log is the history.
- **Graph view:** Local graph around a selected entity. Cytoscape.js. Filter by relation type, depth 1–3. Uses entity-type color mapping from EPIC-003.
- **Core relation types (9):**

| Relation | Inverse | Symmetry | Purpose |
|---|---|---|---|
| `located_in` | `contains` | directed | Spatial |
| `part_of` | `has_part` | directed | Structure / hierarchy |
| `ranks_above` | `ranks_below` | directed | Power / rank |
| `ally_of` | `ally_of` | symmetric | Positive social |
| `enemy_of` | `enemy_of` | symmetric | Negative social |
| `blood_relative` | `blood_relative` | symmetric | Family |
| `owns` | `owned_by` | directed | Ownership |
| `knows_secret` | `secret_known_by` | directed | Narrative / GM |
| `connected_to` | `connected_to` | symmetric | Generic catch-all |

Specific relations (teacher, employer, etc.) are expressed via `connected_to` with notes.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| M2-S08: Relations SQLite schema & campaign log | Verified | commit 95e473c — `relations` + `campaign_relation_log` tables, idempotent. |
| M2-S09: Relation type registry | Verified | commit b728328 — 9 types, directed/symmetric, labels. |
| M2-S10: Relation service layer | Verified | commit c746a4e — addRelation, getRelations, deactivate, reactivate + campaign log. |
| M2-S11: Entity picker component | Verified | commit db53c97 — search, alias filter, type filter, keyboard nav. |
| M2-S12: Relations tab on entity detail | NEEDS_DECISION | commit 95655bd — production code complete; test file has syntax error (await in non-async it at line 92). |
| M2-S13: Local graph view | Verified | commit a64c1b5 — EntityGraph + buildGraphData, Cytoscape.js, depth/filter/inactive controls. |

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/05_Search_Knowledge_Views.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
