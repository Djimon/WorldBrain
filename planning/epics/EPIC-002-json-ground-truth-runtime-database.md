# EPIC-002: JSON Ground Truth & Runtime Database

## Goal

Define and implement the project storage model: many JSON files as Ground Truth, SQLite as runtime/index/cache, and deterministic Git-friendly output.

## Scope

- Project folder structure.
- JSON schemas and validation.
- Runtime import pipeline into SQLite.
- Pretty-printed deterministic JSON output.
- `.gitignore` strategy for runtime/cache files.
- ZIP import/export boundary at the project-folder level.

## M1 Storage Lane Decision

Base JSON files are the authoritative source of truth for predefined,
configured, and base content. This includes project metadata, configured entity
types, plugin-provided base content, and base entity documents.

Base JSON is imported into SQLite for fast UI reads and queries. Runtime code
should read from SQLite projections instead of repeatedly scanning project JSON
files during normal app use.

Campaign/session progression is durable SQLite database state and must not
write, mutate, or backfill base JSON. M1 uses one SQLite database with `base_`
and `campaign_` table prefixes rather than separate database files.

`base_*` tables are rebuildable from JSON. A base re-import can rebuild imported
base rows because base JSON remains authoritative.

`campaign_*` tables are durable runtime state and survive base re-imports.
Campaign rows represent play/session progression and must be preserved unless a
future explicit migration, backup, or export workflow says otherwise.

Campaign overlay/export is a later boundary and not implemented in M1 unless
explicitly implemented by a later Story.

## Base JSON Project Layout

Base project content is stored as JSON files under a predictable project folder
layout:

```text
project.json
entity-types/*.json
entities/{type}/*.json
schemas/base/project.schema.json
schemas/base/entity-type.schema.json
schemas/base/entity.schema.json
```

`project.json` stores project metadata. `entity-types/*.json` stores base entity
type definitions. `entities/{type}/*.json` stores base entities grouped by core
entity type.

The M1 core entity types are Character, Location, Faction, Item, Event, Quest,
Scene, Rule, Resource, and Culture.

Base entity documents use stable identity and metadata fields: `id`, `type`,
`title`, `summary`, `aliases`, `properties`, `body`, `visibility`,
`created_at`, and `updated_at`. Rich body content is stored as
`portable_blocks_v1`; editor behavior is outside this Story.

## Runtime SQLite Schema Boundary

M1 uses a single SQLite runtime database. Repository-owned schema SQL creates
`base_entity_types`, `base_entities`, `campaign_entity_overrides`, and
`campaign_notes` with idempotent `CREATE TABLE IF NOT EXISTS` statements.

`base_` tables hold rebuildable imported JSON data. `campaign_` tables hold
durable runtime data. Structured entity, type, body, property, and override
payloads are stored as JSON text where M1 has no narrower column requirement.

## Base JSON Validation Policy

Validation distinguishes project-level failures from independent document
failures. Invalid `project.json` blocks project load. Invalid entity type
definitions are reported and prevent dependent entities of that type from
importing. Invalid independent base entity files are skipped and reported
without blocking the whole project.

Validation results are structured data for callers: every error carries file
path, document kind, severity, and actionable message. Validation does not
mutate JSON files and does not write campaign tables.

## Deterministic Base JSON Serialization

Base JSON serialization uses two-space indentation, a trailing newline, stable
top-level key ordering, and stable filenames. Entity filenames are generated
from stable `type` and `id` fields as `entities/{type}/{id}.json`, not from
mutable title text alone.

Base serializers omit runtime DB-only fields and do not write campaign/session
progression into base JSON. Campaign overlay/export remains a later boundary.

## Out Of Scope

- Git UI.
- PostgreSQL support.
- Multi-user sync.
- Full entity history.

## Open Decisions

- How strict validation is during load: block project vs. partial load with errors.
- SQL dialect neutrality requirements.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| #10 M1-S01: Base JSON and campaign DB storage lanes | Verified | Storage lane decision documented: base JSON is authoritative, SQLite is runtime projection, and campaign state is durable DB data. |
| #11 M1-S02: Base JSON project layout and schemas | Verified | Base project folder layout and minimal project, entity type, and entity JSON Schemas are defined. |
| #12 M1-S03: SQLite runtime schema | Verified | Idempotent SQLite schema creates base and campaign tables in one database. |
| #13 M1-S04: Structured validation policy | Verified | Base JSON load validation returns structured blocking and non-blocking results without mutation. |
| #14 M1-S05: Base JSON import pipeline | Blocked | Depends on #12 and #13. |
| #15 M1-S06: Effective entity read model | Blocked | Depends on #12 and #14. |
| #16 M1-S07: Runtime database placement and gitignore boundary | Ready | Unblocked by #12. |
| #17 M1-S08: Deterministic JSON serialization | Verified | Base entity and project serializers use stable formatting, key ordering, and filename generation. |

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/09_Decision_Log_And_Open_Questions.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
