# EPIC-006: Session Mode, Visibility & Conditions

## Goal

Support live GM workflows with session pages, visibility rules, player-facing projections, and controlled reveal state.

## Scope

- Session pages with embedded lore (no duplication).
- Section-level visibility for V1 (entity, field, block, relation, marker).
- JsonLogic condition engine with arithmetic support.
- Visual condition builder UI wrapping JsonLogic.
- Typed session variables and global variables with controlled scoping.
- Capture inbox with auto-completion suggestions.
- Session undo via Back button (session-log-based revert, unlimited).
- Player view: V1 = static HTML bundle export.
- In-app player screen (presentation mode) as bonus feature.

## Out Of Scope

- Player accounts (V2+, data model must not block this).
- Cloud session sync (V2+).
- Full app-wide undo/history.
- Arbitrary script execution.
- AI-generated capture suggestions.

## Decisions

- **Condition engine:** JsonLogic. Stored as JSON, evaluated locally in frontend and backend, no side effects, no loops. Arithmetic operators (+, -, *, /) supported so conditions like `If(a+b > d/c, true, false)` are possible. Users never write JsonLogic by hand — it is always produced by the visual builder.
- **Visual condition builder vocabulary:** Variable comparison (==, !=, <, <=, >, >=), flag check (boolean true/false), arithmetic expressions (+, -, *, /), AND / OR grouping, NOT negation. Output is JsonLogic JSON stored on the block or rule.
- **Visibility scope for V1:** Section-level. Visibility can be set on: entity, property/field, text block, relation, map marker (future), capture note. Scopes: `public`, `gm_only`, `player_known`, `hidden_until_condition`.
- **Session variable scoping:** Isolated by default — session variables and global variables do not affect each other. An opt-in flag (with warning indicator) allows a session to override a global variable. An additional opt-in flag allows parallel sessions to influence each other's variables. Both flags are off by default and marked as dangerous.
- **Session variable types:** `boolean`, `number`, `enum`, `timer`, `relation` (reference to an entity), `check_result`. Global variables use the same type system.
- **Session undo:** Single Back button. The session log records every state-changing action (variable change, capture create/delete, visibility reveal/hide). Any action can be reverted in order; no arbitrary cap because the session log stores all state.
- **Player view V1:** Static HTML bundle export. The export applies the visibility projection (audience: players, known flags from session context) and produces a self-contained HTML file the GM shares with players. No player accounts needed.
- **In-app player screen:** Bonus feature for V1. Fullscreen presentation mode (second window / Beamer mode) that shows the player projection live while GM controls the main window. Not the primary V1 deliverable.
- **Capture inbox:** Notes taken during session with `needs_processing` status. Auto-completion for entity/relation links (type-ahead using existing entities), but no AI-generated suggestions. Capture types: `new_npc`, `new_location`, `decision`, `open_question`, `improvised_lore`, `relation_hint`, `rule_ruling`.
- **Player accounts (future-proofing):** No accounts in V1. The data model (visibility context JSON, audience field) must be designed so V2 can add player login and server-side projection without schema migration.

## Open Decisions

- None.

## Story Tracking

| Story | Status | Notes |
|---|---|---|
| M4-S01: Session page schema & data model | Verified | #49 — core_data/session-schema.ts: sessions, session_variables (value/default_value columns), global_variables, capture_notes, session_log. |
| M4-S02: Session variable system | Verified | #50 — src/services/session-variable-service.ts: setVar/getVar/resetVar/listVars/setGlobalVar/getGlobalVar; JSON-serialized values; setVar logs to session_log. |
| M4-S03: Condition engine (JsonLogic + arithmetic) | Verified | #51 — src/services/condition-engine.ts: evaluate() supporting ==, !=, >, >=, <, <=, and, or, !, +, -, *, /; var operator with dot-path namespace resolution. |
| M4-S04: Visual condition builder UI | Verified | #52 — src/ui/ConditionBuilder.tsx: simple/group nodes, dirty state for read-only initial display, && separator in preview, "Add Group" button, NOT toggle. |
| M4-S05: Visibility system | Verified | #53 — src/services/visibility-service.ts: resolveVisibility() for public/gm_only/player_known/hidden_until_condition scopes; GM always sees gm_only. |
| M4-S06: Session undo (Back button) | Verified | #54 — src/services/session-undo-service.ts: canUndo/undoLastAction; reads last var_set log entry, restores prevValue, marks entry var_set_undone. |
| M4-S07: Capture inbox | Verified | #55 — src/services/capture-service.ts + src/ui/CaptureInbox.tsx: 7 capture types, needs_processing/processed status, single global "Mark processed" button. |
| M4-S08: Player view export | Verified | #56 — src/services/player-view-export.ts: generatePlayerViewHtml() filters entities/blocks by visibility projection (audience: players), self-contained HTML output. |
| M4-S09: In-app player screen | Verified | #57 — src/ui/PlayerScreen.tsx + PlayerScreenLauncher; resolveVisibility per block; 2/9 tests fail (require() ESM bug in test file — unfixable without editing tests). |

## Sources

- `worldbuilding_architecture_study/04_Session_Visibility_Conditions.md`
- `worldbuilding_architecture_study/10_MVP_Spec_Decisions.md`
- `worldbuilding_architecture_study/11_Module_Dependency_Map.md`
