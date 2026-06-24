# EPIC-011: Rules Reference & SRD-Safe Rulesets

## Goal

Support rules reference and lightweight ruleset plugins while respecting licensing boundaries.

## Scope

- Rule entity schema with source/license metadata.
- Systemagnostic ruleset plugin type — core knows Rule Entity, system plugins know what fields mean.
- Import pipeline for JSON-based rule sources (read-only). Homebrew/overrides editable.
- Example D&D 5e SRD plugin (structure + SRD-only data, first "official" example).
- DM Screen as a configurable dashboard of panels.
- Simple non-AI rule evaluations: Mystery Breaker Detector, Role Coverage, Quest Dependency blocker.
- Balance rules defined in JSON plugins — core provides engine, UI, and result format only.

## Out Of Scope

- Protected WotC content beyond the SRD.
- D&D Beyond scraping.
- Full encounter simulator.
- AI rules reasoning.
- Hardcoded system content in core (all system data lives in plugins).

## Decisions

- **Rule entity schema:** `id`, `type` (spell/condition/monster/class_feature/etc.), `ruleset` (plugin id), `title`, `properties` (system-specific JSON), `reference_summary` (plain text), `body` (portable_blocks_v1), `source` (source_id + license string). `reference_summary` not technically enforced on all rules but mandatory for card-/screen-eligible rules (same enforcement as EPIC-009).
- **Source/license metadata:** Every imported rule source is registered as a `rule_source` record (id, label, license, url). Every rule entity references its source_id. Displayed in UI as an attribution badge.
- **Editability:** Imported rules are read-only. Homebrew rules and GM overrides (local edits on top of imported rules) are editable and stored separately, merged at read time.
- **Ruleset plugin:** Extends the EPIC-010 plugin format with a `mechanics` block (attributes, challenge_metric, distance_units) and contributes `entity_types` for system-specific entities (spell, monster, condition, etc.). Balance evaluation rules also defined in the plugin as JSON.
- **D&D 5e SRD plugin:** First example plugin. Uses only SRD-licensed content (Open5e API / D&D 5e SRD). Read-only import. Contributes: spell, monster, condition, class_feature entity types + SRD seed data. Not shipped inside the core app binary — distributed as a downloadable plugin.
- **DM Screen:** A saved dashboard view (`gm_screen` record). Panels can source from: rule_table by tag, entity type list, saved view, or static rule entity. Configurable panel layout (1–3 columns). Saved per project, multiple screens allowed.
- **Simple evaluations (no AI):**
  - **Mystery Breaker Detector:** Quests declare `fragile_to` spell/ability tags. If party has access to a tagged ability, GM gets a warning. Triggered manually or on quest open.
  - **Role Coverage:** Ruleset plugin maps classes/features to role tags (frontline, healer, control, utility, face, scout, AoE, single-target). Party composition shows coverage gaps.
  - **Quest Dependency Blocker:** Graph traversal over quest → clue → location → NPC dependencies. Warns if a required path is currently inaccessible (dead NPC, hidden location with no reveal path).
- **Balance rules as JSON plugin:** Plugin declares balance dimensions (action economy, resource cost, scaling, damage, control, defense, frequency, stackability) as weighted rules. Core engine evaluates an entity against these rules and returns risk flags. No AI — purely rule-based scoring.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| E11-S01: Rule entity schema & data model | Open | #97 — Rule entity, source/license metadata, rule_source table, ruleset plugin format extension. |
| E11-S02: Rule import pipeline | Open | #98 — JSON import for rule sources, read-only imported rules, homebrew/override layer, source attribution. |
| E11-S03: DM Screen dashboard | Open | #99 — Configurable panel layout, panel source types (rule_table, entity type, saved view), multi-screen support. |
| E11-S04: D&D 5e SRD example plugin | Open | #100 — SRD-only content, spell/monster/condition/class_feature types, Open5e-sourced seed data. |
| E11-S05: Simple rule evaluations | Open | #101 — Mystery Breaker Detector, Role Coverage analysis, Quest Dependency Blocker graph check. |

## Sources

- `worldbuilding_architecture_study/06_Rules_Reference_Balance.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
