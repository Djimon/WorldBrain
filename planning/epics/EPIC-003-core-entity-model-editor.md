# EPIC-003: Core Entity Model & Editor

## Goal

Build the core entity model and editing experience for V1 entity types.

## Scope

- Core entity types: Character, Location, Faction, Item, Event, Quest, Scene, Rule, Resource, Culture.
- Entity properties and body blocks.
- Block-JSON as internal body truth.
- Markdown-first editor UX.
- Entity page/detail view.
- Structured special blocks such as entity embeds, secret blocks, map embeds, timeline embeds, rule references, and card previews.

## Out Of Scope

- Custom WYSIWYG editor from scratch.
- Arbitrary plugin scripts.
- Full entity history.

## Open Decisions

- Editor library choice.
- Minimal V1 block vocabulary.
- How Markdown import/export maps to special blocks.

## Sources

- `worldbuilding_architecture_study/01_Core_Data_Model.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
