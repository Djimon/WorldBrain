# WorldBuilderX Roadmap

This roadmap is intentionally high-level. Epics live in Markdown; Stories should become GitHub Issues once the repository is available.

## Epic Index

| Epic | Title | Primary Sources |
|---|---|---|
| [EPIC-001](epics/EPIC-001-project-foundation-local-app-shell.md) | Project Foundation & Local App Shell | `00`, `11`, `13` |
| [EPIC-002](epics/EPIC-002-json-ground-truth-runtime-database.md) | JSON Ground Truth & Runtime Database | `01`, `09`, `10`, `11` |
| [EPIC-003](epics/EPIC-003-core-entity-model-editor.md) | Core Entity Model & Editor | `01`, `10` |
| [EPIC-004](epics/EPIC-004-relations-knowledge-graph-core.md) | Relations & Knowledge Graph Core | `01`, `05`, `11` |
| [EPIC-005](epics/EPIC-005-search-knowledge-views.md) | Search & Knowledge Views | `05`, `11` |
| [EPIC-006](epics/EPIC-006-session-mode-visibility-conditions.md) | Session Mode, Visibility & Conditions | `04`, `10`, `11` |
| [EPIC-007](epics/EPIC-007-time-events-world-state-light.md) | Time, Events & World State Light | `03`, `10`, `11` |
| [EPIC-008](epics/EPIC-008-map-import-annotation.md) | Map Import & Annotation | `02`, `04`, `11` |
| [EPIC-009](epics/EPIC-009-cards-handouts-export-pipeline.md) | Cards, Handouts & Export Pipeline | `07`, `10`, `11` |
| [EPIC-010](epics/EPIC-010-plugin-extension-system.md) | Plugin & Extension System | `08`, `10`, `12` |
| [EPIC-011](epics/EPIC-011-rules-reference-srd-safe-rulesets.md) | Rules Reference & SRD-Safe Rulesets | `06`, `10` |
| [EPIC-012](epics/EPIC-012-project-operations-packaging.md) | Project Operations & Packaging | `08`, `10`, `11` |

## Recommended Build Bias

1. Build the project foundation, JSON validation, runtime database, and simple entity page first.
2. Add search early; weak search is a product risk.
3. Keep maps, cards, rulesets, and packaging behind stable data and projection boundaries.
4. Avoid VTT scope, plugin scripts, AI ground-truth edits, and custom card designers in V1.

## Open Cross-Epic Decisions

- Save model: immediate JSON write vs. runtime DB with explicit snapshot/export.
- Relation metadata: notes, visibility, and time ranges.
- Required V1 renderer registry entries.
- Plugin validation strictness.
- Initial proof-of-concept scope.
