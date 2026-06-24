# EPIC-010: Plugin & Extension System

## Goal

Allow safe data-driven extension without executable plugin scripts in V1.

## Scope

- Folder-based plugins with `plugin.json` manifest.
- Plugin contributes: entity types, relation types, card templates, views, rules, assets (icons, themes).
- Three-layer architecture: JSON Schema (data) → UI Schema (optional, layout) → Core Renderer (registered, no custom JS).
- 16 general + 8 worldbuilding-specific core renderers registered and available.
- Default form generator: JSON Schema alone produces a usable form.
- UI Schema mandatory only when plugin uses custom renderer references.
- Plugin validation, compatibility check, conflict detection, load reporting.
- Version migration via full replace.

## Out Of Scope

- Plugin-provided JavaScript, Python, or WASM.
- Runtime code execution from plugin JSON.
- Marketplace / distribution / signing system.
- Plugin hot-reload (restart required to pick up new plugins).

## Decisions

- **Plugin format:** Folder-based. Each plugin is a directory containing `plugin.json` (manifest) and optional subdirectories: `entity_types/`, `relation_types/`, `card_templates/`, `views/`, `rules/`, `assets/`. Plugins are dropped into a central plugin folder managed by the app (not user-chosen paths).
- **Manifest:** `id`, `label`, `version`, `compatibility.app_schema` (semver range), lists of contributed resource IDs per category.
- **Three layers:**
  - **Layer 1 — JSON Schema:** Always required. Describes data shape. Drives validation and default form generation.
  - **Layer 2 — UI Schema:** Optional. Describes form layout and control types. Mandatory if the plugin references any `renderer` field in its structure JSON.
  - **Layer 3 — Core Renderer:** Plugin may reference only registered core renderers by name (e.g. `core.dice_expression_input`). No custom renderer JS allowed in V1.
- **Core renderers V1 (general):** `core.text_input`, `core.text_area`, `core.rich_text`, `core.number_input`, `core.boolean_toggle`, `core.select`, `core.multi_select`, `core.date_time_picker`, `core.entity_picker`, `core.relation_picker`, `core.repeater`, `core.condition_builder`, `core.file_asset_picker`, `core.map_coordinate_picker`, `core.dice_expression_input`, `core.markdown_preview`.
- **Core renderers V1 (worldbuilding-specific):** `core.entity_embed`, `core.secret_block`, `core.map_marker_editor`, `core.timeline_event_editor`, `core.card_preview`, `core.statblock_editor`, `core.rule_reference_block`, `core.capture_inbox_item`.
- **Default form generator:** JSON Schema with no UI Schema produces a functional form (text inputs, number inputs, toggles, selects) auto-derived from property types. Good enough for simple entity types. Plugins that want sliders, pickers, or grouped sections must supply a UI Schema.
- **Plugin validation:** On load, validate: manifest JSON Schema, all referenced renderer IDs exist in core registry, all entity type schemas are valid JSON Schema, compatibility.app_schema matches current app version. Unknown fields in plugin JSON are preserved, not errors.
- **Conflict rules:** Two plugins contributing the same entity type `id` → second plugin wins (load order: alphabetical by plugin folder name). Conflict logged as warning. No merge.
- **Version migration:** Full replace. When a plugin is updated, its contributed definitions overwrite the previous version. Existing entity data that referenced the old schema is preserved with an `outdated_schema` flag if required fields changed.
- **Assets:** Plugins may contribute icons (SVG) and theme color tokens. Loaded into the asset registry at plugin load time. No custom CSS files — color tokens only.
- **Load reporting:** Plugin manager UI shows each plugin: loaded / failed / outdated / conflict. Error details accessible per plugin.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| E10-S01: Plugin manifest & loader | Open | #91 — Folder scan, plugin.json parse, plugin registry, central plugin directory. |
| E10-S02: Core renderer registry | Open | #92 — All 24 core renderers registered and resolvable by name. |
| E10-S03: Default form generator | Open | #93 — JSON Schema → auto-generated form UI without UI Schema. |
| E10-S04: Plugin entity & relation types | Open | #94 — Load entity/relation type definitions, integrate with entity service and relation type registry. |
| E10-S05: Plugin card templates & assets | Open | #95 — Load card templates and icon/theme assets from plugin into their respective registries. |
| E10-S06: Plugin validation, conflicts & load reporting | Open | #96 — Compatibility check, conflict detection, outdated_schema flag, plugin manager UI. |

## Sources

- `worldbuilding_architecture_study/08_UI_Plugin_Architecture.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/12_Core_Engine_Strategy.md`
