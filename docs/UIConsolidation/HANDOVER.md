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
  (compact 0.8rem) — tuned to match the app; do NOT bump back to 650.
- **`<Segmented>`**: `value` · `options: {id,label,title?}[]` · `onChange(id)` · `label` (aria) ·
  `orientation` · `size` · `disabled` (disables the whole group). Renders a `role="group"` of
  `<Button aria-pressed>` items. **Look = separated individual buttons** (user's explicit choice
  over iOS-joined). `.ui-segmented` is just a flex wrapper.

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

## REMAINING (do next, in this order)
1. **MapViewer Tool-Leiste** (`src/ui/MapViewer.tsx` ~line 726-845). The mode buttons
   (navigate 🗺 / pin 📍 / token 🧙 / grid ⊞ / measure) use `.map-tool-btn` with `.active`. Tricky
   because: the **grid ⊞** and **measure** buttons are `.map-tool-group` **flyout triggers** (open
   `.map-tool-flyout` menus — must keep that logic), and **zoom +/−/⌂** (~838-840) are plain
   `.map-tool-btn` actions. The **pin 📍** button is now also a flyout group (from feature `cca347b`) —
   don't break it. Plan: the pure mode buttons could become `<Button size=icon aria-pressed>` (icon
   toggles), keeping the flyout `<div>`s around the grid/measure/pin ones; zoom → `<Button variant=ghost size=icon>`.
   `.map-tool-btn` / `.map-toolbar` / `.map-tool-group`/`__arrow` / `.map-tool-flyout*` CSS lives in
   style.css ~2130-2250. Keep the flyout CSS. Verify: no `.map-tool-btn` uses remain, flyouts still open.
2. **LayerPanel** (`src/ui/LayerPanel.tsx`). `.layer-panel__toolbar button` **element selector**
   (style.css ~3596, "Outline-accent action button" comment) styles the toolbar buttons; the row
   `.layer-panel__controls` buttons (visibility/move/delete) are currently UNSTYLED raw buttons.
   Same playbook as TokenEditor: migrate all buttons in the panel → `<Button>` (toolbar ones =
   `tone=accent variant=outline size=compact`; row icons = `variant=ghost size=icon`), then delete the
   `.layer-panel__toolbar button` element selector. Check for a `.layer-panel__delete-confirm` (inverse-dead).
3. **Graph Layout-Toggle** (`src/ui/GlobalGraphView.tsx`, `.gv-layout-toggle` / `.gv-layout-toggle__btn`
   3D/2D, in graph.css ~29-38). It's a **glass** pill container over the canvas. Migrate to `<Segmented>`;
   the items need the glass look → either pass a glass-ish wrapper or add `size` and accept the separated
   look. Since Segmented items are solid `<Button>`, over the canvas they'll be opaque — decide with the
   user whether that's ok or whether Segmented needs a glass mode. (Graph panels use `--gv-panel-bg`.)
   Delete `.gv-layout-toggle__btn` after.
4. **Tabs consolidation** → use the EXISTING **`<Tabs>`** primitive (already in primitives.tsx:
   `activeId`/`options`/`onSelect`/`label`), NOT Segmented. Three real tab strips:
   - `.cal-tabs`/`.cal-tab` — CalendarWizard (`src/ui/CalendarWizard.tsx:230`), drop-in (audit said API matches 1:1).
   - `.entity-detail__tab` — EntityDetailView (~381): **structural** — each tab carries a `render()` fn
     (`TabDefinition.render`), so keep the content dispatch and swap only the tab-strip UI for `<Tabs>`.
   - `.maps-sidebar-tabs__*` / `.map-side-collapsed__tab` — MapsSidebarTabs + MapViewer's hand-rolled
     duplicate (MapViewer:1052) — has a collapsed/vertical mode `<Tabs>` doesn't support yet (needs a variant).
   Delete the `.cal-tab*` / `.entity-detail__tab*` / `.maps-sidebar-tabs*` CSS as each is emptied.

## Conventions / gotchas (do every time)
- **Per commit**: `export PATH="/c/Program Files/nodejs:$PATH"` then `npx tsc --noEmit`; the pre-commit
  hook runs tsc+eslint and blocks on failure. Use the Bash tool (not PowerShell). Node 24.17.0.
- **Commit style**: `refactor(ui-consolidation): …` (or `feat`/`fix`), end body with
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- **Behavior-preserving**: value-identical CSS swaps; migrate to the standardized look, flag any
  intentional visual change to the user (they eyeball in the running Tauri app — this agent can't
  boot Tauri/SQLite here, so verify via `tsc` + targeted vitest + reasoning, and ask the user to eyeball).
- **Pre-existing broken tests to IGNORE** (not caused by this work — confirmed via `git stash`):
  `m2-s06/m2-s07` EntityDetailView `.status` crash (filed as **#343** in Djimon/WorldBrain),
  `m15-s06-map-tokens` column-count schema drift, `m11-s04` opens deleted `MapMarkers.tsx` (ENOENT),
  `m5-s10-map-viewer` + `m5-s16` stale (canvas-vs-img). When a test run shows failures, diff against
  baseline (`git stash` the change) before blaming your edit.
- **LF→CRLF warnings** on commit are harmless (git autocrlf).
- Verify each migration with `grep` that the old classes are gone from BOTH the .tsx and style.css,
  and that self-styled/kept widgets survive (e.g. `.token-editor__chip-icon-trigger`, `.pin-icon-picker`).

## After remaining 4: the bigger picture (from README.md, not yet started)
ListRow primitive (⛔ biggest gap), Field convergence (+ decouple PropertiesForm), Chip/Panel primitives,
then the ITCSS-lite `styles/` restructure + primitive palette layer → community themes. All optional/later.
