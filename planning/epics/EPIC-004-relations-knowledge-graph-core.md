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
| M2-S12: Relations tab on entity detail | Verified | commit 7fab5ae — active/inactive sections, deactivate/reactivate, inverse label direction, gm_only badge, add flow. |
| M2-S13: Local graph view | Verified | commit a64c1b5 — EntityGraph + buildGraphData, Cytoscape.js, depth/filter/inactive controls. |

## Bug Fixes & Refactors (post-M2)

| Issue | Status | Notes |
|---|---|---|
| #58: EntityPicker database prop | Verified | commit 21efcc1 |
| #59: RelationsTab/EntityGraph DatabaseLike typing | Verified | commits 9902ebe, 874a15f |
| #60: EntityGraph depth/filter wired to data | Verified | commit 874a15f |
| #61: collision-safe IDs (crypto.randomUUID + rel_ prefix) | Verified | commit b54dbd6 |
| #62: RelationsTab registered via tab-wiring.tsx | Verified | commit 0e4ea0f |
| #63: part_of label corrected to 'part of' / 'has part' | Verified | commit 3b247f9 |
| #64: DB_SENTINEL + forceUpdate removed; useState for relations | Verified | commit 9902ebe |
| #65: WritableDatabaseLike exported from entity-service | Verified | commit cffa326 |
| #66: GM-only visibility toggle in add-relation form | Verified | commit 9902ebe |

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/05_Search_Knowledge_Views.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
