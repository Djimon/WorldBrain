# EPIC-004: Relations & Knowledge Graph Core

## Goal

Represent relations as first-class data and expose them through reusable relation tooling.

## Scope

- Typed edge table.
- Relation type registry with inverse labels.
- Entity picker.
- Relation picker.
- Relation browser.
- Relation projections into entity pages and graph-oriented views.

## Out Of Scope

- Neo4j or external graph database.
- Advanced graph analytics.
- Multi-user relationship workflows.

## Open Decisions

- Whether relations have their own notes/body.
- Whether relations have visibility rules.
- Whether relations have time ranges.
- Minimum relation types for V1.

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/05_Search_Knowledge_Views.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
