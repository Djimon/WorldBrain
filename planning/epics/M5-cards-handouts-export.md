# EPIC-009: Cards, Handouts & Export Pipeline

## Goal

Generate table-ready cards and handouts as projections of entity data, applying templates and visibility rules.

## Scope

- Card templates defined as JSON (field slots, size, overflow policy, style options).
- Cards as projections — entity is source of truth, card is a view.
- 9 built-in card categories, each with category-specific required fields.
- `reference_summary` as mandatory field for Rule, Spell/Ability, and Condition categories.
- Card sizes: Poker (63×88mm), Tarot (70×120mm), Moderation card (105×148mm), A4 sheet.
- Print sheet composer: A4 3×3, cut marks, optional backside template.
- PDF export via @react-pdf/renderer (no headless browser).
- PNG export via canvas.toBlob().
- Handout types: Letter, Clue Sheet, Faction Dossier, Session Recap, Shop Sheet.
- Visibility-aware export: applies player projection from EPIC-006.
- Templates extensible by plugins (plugin supplies JSON template + UI schema).

## Out Of Scope

- Freeform drag-and-drop card designer.
- Pixel-perfect arbitrary template editor.
- AI-assisted card summaries.
- Map Fragment handout (covered in EPIC-008).

## Decisions

- **Cards are exports, not entities.** A card record stores `entity_id`, `template_id`, `audience`, `fields[]`. The entity is the source of truth. Cards have a back-reference to the source entity at all times.
- **Export renderer:** @react-pdf/renderer for PDF (React components → PDF buffer directly, MIT, no headless browser, no extra binary). PNG export via `canvas.toBlob()` after rendering the card to an offscreen canvas. Both renderers are abstracted behind a `CardRenderer` interface so the output target is swappable.
- **Card categories V1:** NPC, Item, Spell/Ability, Quest, Clue, Faction, Location, Secret, Condition. Each category has a defined set of required and optional fields. Custom category available for plugin-defined cards.
- **`reference_summary` field:** Mandatory for Rule, Spell/Ability, Condition cards — export blocked without it. Optional (recommended) for NPC, Item, Quest, Faction, Location, Clue. Not applicable to Secret and Custom.
- **Overflow policy per template slot:** `truncate` (cut with indicator), `shrink` (reduce font to minimum), `split` (generate continuation card), `summary_required` (block export if no summary), `reference_only` (show ID/link only). Each template slot defines its own policy.
- **Template customization V1:** Theme color, limited font selection, icon/symbol per category, category-specific field mapping. No pixel-level drag-and-drop designer.
- **Plugin templates:** A plugin can ship a JSON template + optional UI schema (JSON Forms / uiSchema style) for custom card layouts. Plugin templates are loaded into the template registry at runtime.
- **Print sheet:** A4 portrait, 3 columns × 3 rows (9 cards per sheet), cut marks on/off, optional backside template per sheet. Cards are arranged in the order they were added to the print job.
- **Handout types:** Letter (in-world document), Clue Sheet (collected hints), Faction Dossier (player overview), Session Recap (manual or assisted summary), Shop Sheet (offer/prices). Handouts apply the same visibility projection as player view export.
- **Visibility:** All card and handout exports apply the audience + visibility projection from EPIC-006 (`resolveVisibility`). `gm_only` fields are stripped from player exports.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| E9-S01: Card template schema & data model | Open | #84 — Template JSON format, card sizes, category definitions, reference_summary enforcement. |
| E9-S02: Card instance & preview UI | Open | #85 — Create card from entity + template, live preview, field mapping, overflow preview. |
| E9-S03: Print sheet composer | Open | #86 — A4 3×3 layout, cut marks, backside option, card order management. |
| E9-S04: PDF export | Open | #87 — @react-pdf/renderer, card and print sheet output, font embedding. |
| E9-S05: PNG export | Open | #88 — canvas.toBlob() card render, single card and sheet export. |
| E9-S06: Handout model & export | Open | #89 — Letter, Clue Sheet, Faction Dossier, Session Recap, Shop Sheet — HTML + PDF output. |
| E9-S07: Visibility-aware export | Open | #90 — Apply player projection to card/handout fields before render. gm_only fields stripped. |

## Sources

- `worldbuilding_architecture_study/07_Cards_Handouts_Pipeline.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
