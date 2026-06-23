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

## Out Of Scope

- Git UI.
- PostgreSQL support.
- Multi-user sync.
- Full entity history.

## Open Decisions

- Save model: direct JSON write on save vs. explicit export/snapshot from runtime DB.
- How strict validation is during load: block project vs. partial load with errors.
- SQL dialect neutrality requirements.

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/09_Decision_Log_And_Open_Questions.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
