# EPIC-003: Core Entity Model & Editor

## Goal

Build the core entity model and editing experience for V1 entity types.

## Scope

- Core entity types: Character, Location, Faction, Item, Event, Quest, Scene, Rule, Resource, Culture.
- Entity properties and body blocks.
- Block-JSON as internal body truth.
- Markdown-first editor UX with TipTap.
- Entity detail view with extensible tab system.
- Master-detail layout (list + detail).
- Properties form generated from entity-type JSON Schema.
- Structured special blocks: entity_embed, secret_block, rule_reference (M2). Further blocks (map_embed, timeline_embed, condition_block, card_preview) are added as core in their respective Epics.

## Out Of Scope

- Custom WYSIWYG editor from scratch.
- Arbitrary plugin scripts.
- Full entity history.
- map_embed, timeline_embed, condition_block, card_preview blocks (deferred to EPIC-007/008/006/009).

## Decisions

- **Editor library:** TipTap (`@tiptap/react`, MIT license, core stays free). No cloud/collaboration features needed.
- **Block vocabulary for M2:** `paragraph`, `heading`, `list`, `entity_embed`, `secret_block`, `rule_reference`. All are first-class core blocks, not extensions.
- **Block extensibility:** Later Epics add blocks to the core block registry — not as a plugin extension category.
- **Properties editor:** Form-from-schema — typed form generated from entity-type `properties_schema` (JSON Schema). Supported field types in M2: string, enum, boolean, array of string (tags), number.
- **Entity detail view:** Standalone component (`EntityDetailView`) with extensible tab-registration API. Can be embedded in master-detail layout or called standalone (e.g. map popup).
- **Master-detail layout:** Reusable layout primitive — left panel: entity list (filterable by type), right panel: EntityDetailView.
- **Relations in M2:** Not shown on entity detail view. Relations section comes with EPIC-004.
- **secret_block in M2:** Always visible, but with a GM-only visual marker. No Condition Engine check until EPIC-006.

## Decisions (continued)

- **entity-type color mapping for entity_embed chips:**

| Entity Type | Color |
|---|---|
| Character | purple |
| Location | teal |
| Faction | blue |
| Item | amber |
| Event | coral |
| Quest | pink |
| Scene | gray |
| Rule | indigo |
| Resource | olive |
| Culture | green |

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| M2-S01: Entity UI model & service adapter | Verified | src/services/entity-service.ts — getEffectiveEntity + listEntitiesByType. Commit 820efcb. |
| M2-S02: Block type registry | Verified | src/blocks/block-registry.ts — BlockType enum, type guards, getBlockDefinition. Commit f851ed1. |
| M2-S03: TipTap base editor | Verified | src/blocks/block-conversion.ts + src/ui/BodyEditor.tsx. Commit 34c4649. |
| M2-S04: Custom block extensions | Verified | entity_embed, secret_block, rule_reference in block-registry and block-conversion. Commit 7346475. |
| M2-S05: Properties form-from-schema | Verified | src/ui/PropertiesForm.tsx — schema-driven, per-field patch output. Commit e912039. |
| M2-S06: Entity detail view & tab system | Verified | src/ui/EntityDetailView.tsx — registerEntityTab/clearEntityTabs external API. Commit a51c43f. |
| M2-S07: Master-detail entity layout | Verified | src/ui/EntityMasterDetail.tsx — type filter, onEntitySelect, selectedEntityId. Commit f67df0c. |

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
