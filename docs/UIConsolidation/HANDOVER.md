# UI Consolidation — HANDOVER (resume point)

Working state of the button/toggle consolidation so it can continue after a context compaction.
Branch: **`chore/ui-consolidation`** (25 commits, all with green `tsc --noEmit` + `eslint` via the
pre-commit hook). Read [component-library.md](component-library.md) + [README.md](README.md) for the full audit.

## Role & authorization (important)
Normally this agent is **Review-only**. For THIS cleanup task the user granted an explicit one-off
exception to implement + commit ("große Aufräum-Ding, Spezialaufgabe, ändert ja keine Funktion").
The exception covers behavior-preserving consolidation. Two small **features** were also requested
inline and done (pin-icon flyout, TokenEditor scroll) — do only what the user asks; don't self-expand scope.

## The canonical primitives (src/ui/primitives.tsx + primitives.css)
- **`<Button>`**: `tone` = neutral | accent | danger · `variant` = solid | outline | ghost | glass ·
  `size` = md | compact | icon · `shape` = default | circle · merges a passed `className` ·
  spreads `...props` so `aria-pressed`, `disabled`, `title` work. `.ui-button[aria-pressed='true']`
  → accent fill (wins over tone/variant) = **single toggle**. Typography: 0.875rem / weight 500
  (compact 0.8rem) — tuned to match the app; do NOT bump back to 650. Note: `<Button>` does NOT
  forward `ref` — for a flyout trigger needing getBoundingClientRect, put the ref on the wrapping div.
- **`<Segmented>`**: `value` · `options: {id,label,title?}[]` · `onChange(id)` · `label` (aria) ·
  `orientation` · `size` · `variant` = default | **glass** · `disabled` · `className`. Renders a
  `role="group"` of `<Button aria-pressed>` items. **Default look = separated individual buttons**
  (user's explicit choice over iOS-joined). **`variant="glass"`** = translucent framed pill with
  borderless joined-look buttons, for a control over a canvas (graph layout toggle).
- **`<Tabs>`**: `activeId` · `options: {id,label,disabled?}[]` · `onSelect(id)` · `label` (aria) ·
  `fill` (equal-width stretched tabs; tablist grows too) · `className`. Renders `.ui-tabs` (underline
  tabs, accent underline + normal text on the active tab — **not** accent-colored label).

## Canonical mapping rules (apply these; they're the pattern used in every commit so far)
- `.btn` → `<Button>` · `.btn--primary` → `tone=accent` · `.btn--danger` → `tone=danger`
- "+ add" / outline-accent buttons → `<Button tone=accent variant=outline size=compact>`
- "✕" close/remove / ghost → `<Button variant=ghost size=icon|compact>` (we standardized ✕ to
  neutral ghost; the old red-fill-on-hover is intentionally dropped)
- delete with red text (was `.btn` + inline `style={{color:status-failure}}`) → `tone=danger variant=outline` (drop the inline hack)
- toggle group (mutually exclusive, `.active`/`aria-pressed`) → `<Segmented>`
- single on/off toggle → `<Button aria-pressed={state}>`
- FAB / round → `shape=circle` · translucent-over-canvas → `variant=glass` (+ keep a positioning-only className)
- A button carrying a **layout-only** class (align-self/full-width/positioning) → keep it via
  `<Button className="...">`; slim that CSS rule to layout only. Delete the visual button classes.
- **Element-selector coupling** (`.foo button { ... }` styling all descendants): migrate EVERY button
  in that scope, then delete the element selector (see TokenEditor commit `80984b6` for the worked example).

## DONE
Tokens/CSS foundation (commits `8488ef1`→`f74de66`): added `--color-on-accent`, `--color-scrim`,
`--color-overlay-border`, `--radius-pill`, `--space-5`; migrated hardcoded values; deleted dead CSS;
merged duplicate defs.
**Button rollout — 100% of generic `.btn` gone, `.btn` CSS deleted** (`1a5a0d0`→`b422b1d`): primitive
built + every plain button across EntityMasterDetail, Calendar, Audio, Map pin-editor, dialogs,
session/play views, entity views, WorkspaceShell, MapGrid-clear, Graph chrome (glass), edit-pencil.
**Segmented rollout — 4 of the toggle sites done**: FogTools (`2c61cab`), CalendarMonthView year-mode
(`1a32bd5`), TokenEditor mode+element-selector (`80984b6`), MapGrid grid-controls (`906b752`).
Mini-features: pin-icon flyout (`cca347b`), TokenEditor whole-panel scroll (`656060d`).
**MapViewer tool-rail → `<Button size=icon>`** (`a4fb2cb`): mode buttons = aria-pressed, zoom = icon
actions, MapGrid ⊞ trigger migrated too; flyout refs moved to the wrapping div; `.map-tool-btn` deleted.
**LayerPanel buttons → `<Button>`** (`22e0e4a`): toolbar element-selector retargeted to `.ui-button`
(layout only), row controls migrated, delete=danger/outline; collapse chevron left as its own twisty.
**Segmented `variant="glass"` + Graph layout toggle** (`7273ed4`): promoted the graph glass-pill look to
a reusable primitive variant.
**Tabs consolidation — all 4 strips done**: CalendarWizard `.cal-tabs` (`06ca784`), EntityDetailView
`.entity-detail__tab` (`6fd0c8f`), maps sidebar Karten/Ebenen + Pins/Token (`7273f40`, added `<Tabs fill>`
+ per-option `disabled`; collapse button + collapsed vertical strip stay bespoke).

## REMAINING
The button/toggle/tabs consolidation from the original audit is **complete** — no generic `.btn`, no
hand-rolled toggle groups, no hand-rolled tab strips remain. Next up is the bigger-picture work below.

## Conventions / gotchas (do every time)
- **Per commit**: `export PATH="/c/Program Files/nodejs:$PATH"` then `npx tsc --noEmit`; the pre-commit
  hook runs tsc+eslint and blocks on failure. Use the Bash tool (not PowerShell). Node 24.17.0.
- **Commit style**: `refactor(ui-consolidation): …` (or `feat`/`fix`), end body with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Behavior-preserving**: value-identical CSS swaps; migrate to the standardized look, flag any
  intentional visual change to the user (they eyeball in the running Tauri app — this agent can't
  boot Tauri/SQLite here, so verify via `tsc` + targeted vitest + reasoning, and ask the user to eyeball).
- **Pre-existing broken tests to IGNORE** (not caused by this work — confirmed via `git stash`):
  `m2-s06/m2-s07/m2-s12` EntityDetailView/relations-tab `.status` crash (filed as **#343** in
  Djimon/WorldBrain), `m15-s06-map-tokens` column-count schema drift, `m11-s04` opens deleted
  `MapMarkers.tsx` (ENOENT), `m5-s10-map-viewer` + `m5-s16` stale (canvas-vs-img),
  `m5-s02-calendar-wizard` (13, stale multi-step-wizard tests vs the current tabbed form),
  `m14-s06-day-click` (1, title-gate). When a test run shows failures, diff against baseline
  (`git stash` the change) before blaming your edit.
- **LF→CRLF warnings** on commit are harmless (git autocrlf).
- Verify each migration with `grep` that the old classes are gone from BOTH the .tsx and style.css,
  and that self-styled/kept widgets survive (e.g. `.token-editor__chip-icon-trigger`, `.pin-icon-picker`).

## After remaining 4: the bigger picture (from README.md, not yet started)
ListRow primitive (⛔ biggest gap), Field convergence (+ decouple PropertiesForm), Chip/Panel primitives,
then the ITCSS-lite `styles/` restructure + primitive palette layer → community themes. All optional/later.
