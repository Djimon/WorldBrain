# EPIC-010: Plugin & Extension System

## Goal

Allow safe data-driven extension without executable plugin scripts in V1.

## Scope

- Folder-based plugins.
- Required `plugin.json`.
- Optional `entity_types/`, `relation_types/`, `views/`, `card_templates/`, `rules/`, and `assets/`.
- JSON Schema required.
- UI Schema optional.
- Core Renderer Registry references.
- Plugin validation and load reporting.

## Out Of Scope

- Plugin-provided JavaScript/Python/WASM.
- Runtime code execution from plugin JSON.
- Marketplace/distribution system.

## Open Decisions

- Required V1 core renderers.
- Plugin validation strictness.
- Plugin load order and conflict rules.
- Capability registry shape.

## Sources

- `worldbuilding_architecture_study/08_UI_Plugin_Architecture.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/12_Core_Engine_Strategy.md`
