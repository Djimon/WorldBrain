# Graph view — UI Consolidation audit

Scope: `src/ui/GlobalGraphView.tsx`, `src/ui/GraphCanvas.tsx`, `src/ui/GraphFilterPanel.tsx`,
`src/ui/GraphSettingsPanel.tsx`, `src/ui/graph.css` (139 lines). Read-only audit, no source
edits made.

Renderer stack: raw three.js (`GraphCanvas.tsx`), fed style via `src/services/graph-style.ts`
(`typeColor`, `positionColor`, `edgeStyle`, `TYPE_COLOR_TABLE`) — that service file is **out of
scope** for this component set but is the actual canvas-color source of truth; noted for context
only, not audited line-by-line here.

## Canvas render constants vs. UI chrome — the line

This view is unusual: it mixes a WebGL canvas (legitimately owns non-token render colors) with a
normal HTML/CSS overlay (search box, layout toggle, detail panel, settings gear, filter FAB —
all normal DOM, should use tokens). Every hardcoded color found below is tagged:

- **[canvas-render]** — feeds three.js material/light/instance color, or is a per-user "edge
  color" default that ends up as rendered graph data (exposed via a native `<input type=color">`
  picker in `GraphSettingsPanel`). Leave alone — not a token candidate.
- **[ui-chrome]** — DOM/CSS styling of panels, buttons, borders, shadows. Normal consolidation
  target.

No occurrence of the `GROUP_COLORS` palette from the audit brief was found in these 4 files —
that name belongs to `src/spikes/GraphWebglSpike.tsx` (an unrelated spike, not in scope). The
real palette (`TYPE_COLOR_TABLE`) lives in `src/services/graph-style.ts:25-36`, outside this
component set.

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `GlobalGraphView` (`src/ui/GlobalGraphView.tsx:92`) | Top-level graph screen: loads entities/relations/mentions, builds `GraphModel`, owns settings state (persisted to `localStorage`), composes `GraphCanvas` + overlay controls (search, layout toggle, detail panel, filter panel, settings gear) | View-specific container | Yes — same component doubles as the **Ego-Graph** view (`src/tab-wiring.tsx:28`, passes `egoFocusId`) and as the full graph tab in `src/ui/WorkspaceShell.tsx:796` | `.graph-view`, `.graph-view--loading`, `.gv-search`, `.gv-search__input`, `.gv-suggest`, `.gv-suggest__item`, `.gv-suggest__type`, `.gv-layout-toggle`, `.gv-layout-toggle__btn`, `.gv-detail`, `.gv-detail__bar`, `.gv-detail__body`, `.gv-btn`, `.gv-btn--primary` | Local (`graph.css`), none from `primitives.tsx`/`style.css` | `'#d11a0f'` (63), `'#ff3b30'` (64), `'#555555'` (65), `'#d0d0d0'` (66) — all **[canvas-render]** (default edge colors, rendered by `GraphCanvas`, not chrome) |
| `GraphCanvas` (`src/ui/GraphCanvas.tsx:167`) | The one shared three.js renderer core (per file-header comment, D12): scene/camera/lights/instanced-mesh nodes/fat-line edges/bloom/orbit-controls/hover-dim/click-to-zoom/DOM overlay layers for chips+labels | Generic renderer core (designed for reuse across Galaxy/Ring/Ego — all folded into this one component via props) | Single call site today (`GlobalGraphView.tsx:273`), but by design (see file header) it's the shared core for every graph "kind"; Ego mode reuses it via `GlobalGraphView` | None of its own — mounts a bare `<div>` (line 709); DOM overlay elements it creates get classes from `graph.css`: `.gv-chip`, `.gv-node-label`, `.gv-area-label` | N/A (imperative DOM, not JSX-classed) + `graph.css` for the overlay elements it creates | `0xffffff` ambient light (214), `0xffffff` headlight (216) — both **[canvas-render]** (three.js `AmbientLight`/`DirectionalLight` colors) |
| `GraphFilterPanel` (`src/ui/GraphFilterPanel.tsx:17`) | Relation-type filter: funnel FAB (bottom-right, next to gear) opens a bottom pane with "Alle/Keine" buttons + one checkbox per relation type | View-specific (graph-only concept: relation types) | No — single call site (`GlobalGraphView.tsx:322`) | `.gv-filter-pane`, `.gv-filter-pane__head`, `.gv-filter-pane__title`, `.gv-mini-btn` (×2 uses), `.gv-muted`, `.gv-filter-pane__list`, `.gv-check--inline`, `.gv-fab`, `.gv-fab--filter`, `.gv-fab--active` | Local (`graph.css`), none from `primitives.tsx`/`style.css` | None directly (borders come from `graph.css` — see B/C) |
| `GraphSettingsPanel` (`src/ui/GraphSettingsPanel.tsx:36`) | Settings gear (bottom-right) opening a panel: glow toggle, show-all-edges toggle, per-theme relation/mention color pickers + edge-form `<select>`s, mentions-visible toggle | View-specific (graph-only settings) | No — single call site (`GlobalGraphView.tsx:366`) | `.gv-gear-wrap`, `.gv-panel`, `.gv-check` (×2), `.gv-group` (×2), `.gv-group__title` (×2), `.gv-row` (×2), `.gv-field` (×2), `.gv-field__label` (×2), `.gv-gear` | Local (`graph.css`), none from `primitives.tsx`/`style.css` | None directly; `value[relationKey]`/`value[mentionKey]` fed into native `<input type="color">` (67, 85) — **[canvas-render]** values, not CSS |

## B. Duplication & similarity findings

1. **Toggle/segmented-button pattern — `.gv-segbar__btn`, `.gv-layout-toggle__btn`
   (`graph.css:23-38`)**: `aria-pressed='true'` → filled accent background, identical shape to
   `.ui-tabs__tab[aria-selected='true']` in `primitives.css:53-56` (border-bottom accent instead
   of fill, but same semantic: "options row, active = accent"). `.gv-segbar` itself
   (`graph.css:22`) is dead code in the 4 audited files — grep found no `gv-segbar`/`gv-segbar__btn`
   usage in `GlobalGraphView.tsx`, `GraphFilterPanel.tsx`, or `GraphSettingsPanel.tsx` (see §C).
   Would need a **needs-variant** primitive: `<Tabs>` renders `role="tablist"`/`role="tab"`
   semantics, but the graph toggle is a `role="group"` of `aria-pressed` buttons (correct, since
   it's not a tabpanel switch) — not a drop-in swap, but the visual/CSS pattern (pill wrapper +
   filled-active button) duplicates what `.ui-tabs` already solves once.

2. **Panel/card shell — `.gv-panel` (`graph.css:84-88`), `.gv-filter-pane`
   (`graph.css:106-110`), `.gv-detail` (`graph.css:58-62`)**: all three are "bordered box,
   surface-ish translucent background, rounded corners" — the same shape as `.ui-panel`
   (`primitives.css:26-31`). None import `<Panel>`. Differences: `graph.css` panels use the
   locally-derived `--gv-panel-bg`/`--gv-panel-bg-strong` (translucent, `color-mix`) instead of
   opaque `--color-surface`, and add `backdrop-filter: blur(4px)` (`gv-panel:87`,
   `gv-filter-pane:109`) for the glass-over-canvas look — a real, motivated difference (the
   canvas needs to show through), so this is a **needs-variant** case, not a drop-in: `<Panel>`
   would need a "translucent/blurred" variant to be reusable here, it can't just be swapped in
   as-is.

3. **Small icon/FAB buttons — `.gv-gear` (`graph.css:80-83`), `.gv-fab`/`.gv-fab--filter`
   (`graph.css:100-104`)**: both are `40x40`, `border-radius:20px` circular buttons with
   `var(--gv-panel-bg)` background and `var(--gv-border)` border — literally the same rule
   duplicated twice (`.gv-gear` and `.gv-fab` share every property except `.gv-fab` doesn't set
   `width/height/font-size/line-height` inline the same way — actually they do, near-identically).
   No canonical circular-icon-button primitive exists yet in `primitives.css`. **Structural**:
   would need a new primitive variant (`Button` has no circular/icon-only mode today).

4. **`.gv-btn` / `.gv-mini-btn` (`graph.css:69-73`, `114-117`)**: both are unstyled/ghost buttons
   with `border: 1px solid rgba(255,255,255,0.2)` (hardcoded, theme-blind — see §C) — near-dupes
   of each other (padding/font-size differ only) and both duplicate `.ui-button`
   (`primitives.css:1-13`) in spirit (bordered, background transparent by default, accent variant
   for primary action via `.gv-btn--primary` vs `.ui-button[data-tone='accent']`). **Needs-variant**:
   `.ui-button` uses `var(--color-border)` + opaque `var(--color-surface)`; these use a
   translucent/glass look, same gap as finding 2.

5. **Checkbox/label rows — `.gv-check`, `.gv-check--inline`, `.gv-row`, `.gv-field`
   (`graph.css:89-92, 118`)**: hand-rolled `<label>` + control layout, functionally equivalent to
   `.ui-field` (`primitives.css:58-77`) for the `.gv-field`/`.gv-field__label` pair specifically
   (`GraphSettingsPanel.tsx:69-74, 87-92` even reuse the name `gv-field`/`gv-field__label`,
   suggesting the author already had `.ui-field` in mind but re-implemented it locally instead of
   importing `<Field>`). **Needs-variant**: `<Field>` wraps a single `<input>`; here it needs to
   wrap a `<select>` (relation/mention form pickers) and native color/checkbox inputs, which
   `<Field>` doesn't support today (its `input` is hardcoded, not a `children` slot).

6. **Panel toggle triggered by a bottom-right icon button, revealing a floating options
   panel** is the same interaction shape in `GraphFilterPanel` (funnel FAB → `.gv-filter-pane`)
   and `GraphSettingsPanel` (gear → `.gv-panel`) — two independent implementations of
   "collapsed-icon-button + floating panel toggled by local `useState(open)`" with no shared
   component between them, even though they sit 12px apart on screen. **Structural**: would
   benefit from one `<FloatingIconPanel trigger=... >` wrapper shared by both.

## C. CSS hygiene

**Hardcoded colors** (all in `graph.css` unless noted):
- `graph.css:17` — `--gv-on-accent: #fff;` **[ui-chrome]**. This is exactly the "white-on-accent
  foreground (currently hardcoded `#fff`)" gap already called out in
  `_shared-reference.md:23` as a known-missing token — confirmed instance.
- `graph.css:61` — `.gv-detail` `box-shadow: 0 8px 30px rgba(0, 0, 0, 0.45);` **[ui-chrome]**.
  Note `rgba(0,0,0,0.45)` is *exactly* the dark-mode value of `--shadow-panel`
  (`tokens.css:46`), but hardcoded here so it never adapts to light mode (where
  `--shadow-panel` is `rgba(15,18,22,0.12)`, much softer) — a real light/dark defect, not just a
  style nit.
- `graph.css:71` — `.gv-btn` `border: 1px solid rgba(255, 255, 255, 0.2);` **[ui-chrome]**.
  Matches the "overlay/scrim" missing-token gap noted in `_shared-reference.md:22` (a translucent
  white/black border token doesn't exist yet). Also theme-blind: a 20%-white border reads fine on
  the dark canvas but will nearly disappear against light-theme `--gv-panel-bg`.
- `graph.css:116` — `.gv-mini-btn` — identical `rgba(255, 255, 255, 0.2)` border, same issue,
  duplicated from line 71 instead of shared.
- `GlobalGraphView.tsx:63-66` — `'#d11a0f'`, `'#ff3b30'`, `'#555555'`, `'#d0d0d0'` **[canvas-render]**
  default edge colors — correctly excluded from tokens (they're graph data defaults, user-editable
  via color picker), listed here only for completeness per the report format.
- `GraphCanvas.tsx:214,216` — `0xffffff` × 2, three.js light colors, **[canvas-render]**, correctly
  out of token scope.

**One-off classes** (defined once in `graph.css`, used from exactly one component):
- `.gv-search`, `.gv-search__input`, `.gv-suggest`, `.gv-suggest__item`, `.gv-suggest__type`,
  `.gv-layout-toggle`, `.gv-layout-toggle__btn`, `.gv-detail*`, `.gv-btn*` — all only in
  `GlobalGraphView.tsx`.
- `.gv-filter-pane*`, `.gv-fab*`, `.gv-mini-btn`, `.gv-check--inline`, `.gv-muted` — all only in
  `GraphFilterPanel.tsx`.
- `.gv-gear-wrap`, `.gv-gear`, `.gv-panel`, `.gv-field*`, `.gv-check`, `.gv-row`, `.gv-group*` —
  all only in `GraphSettingsPanel.tsx`.
- This is expected for a scoped view stylesheet (not a hygiene defect by itself), noted per
  format requirement.

**Dead classes**: `.gv-segbar` and `.gv-segbar__btn` (`graph.css:22-27`) — no matching
`className` in any of the 4 audited `.tsx` files, nor in `GraphLookTuner.tsx` or
`GraphWebglSpike.tsx` (checked via grep across `src/`). Confirmed dead CSS.

**`!important` uses**: none found in `graph.css`.

**Magic numbers that should be tokens**:
- Border radii: `6px`/`8px`/`10px`/`20px` scattered across `graph.css:24, 32, 35, 43, 47, 58, 70,
  81, 85, 101, 106, 115` — none use `--radius-sm` (4px) or `--radius-md` (6px); several are new
  sizes (`8px`, `10px`, `20px` pill) not in the token set at all (the `999px`/`100px` "larger
  radii" gap flagged in `_shared-reference.md:22` — `20px` circular buttons are a concrete new
  case for that).
  - `6px`: 24, 35, 43, 70, 115 (matches `--radius-md` exactly — should just use the token).
  - `8px`: 32, 47, 58 (no token; new size).
  - `10px`: 81, 85 (no token; new size).
  - `20px`: 101 (circular-button радius; no token; new size).
- Z-index ladder: `z-index: 5/6/7` hardcoded at `graph.css:31 (7), 41 (6), 58 (6), 77 (5), 104
  (5), 107 (5)` — an implicit stacking contract across 3 components with no named constants
  anywhere (not even a comment table). Fragile: a new overlay added by a future story has no
  documented range to pick from.
- Pixel gaps/paddings (`4px`, `6px`, `8px`, `12px`, `14px`, `16px` etc.) mostly don't map to
  `--space-1..4` (`.25/.5/.75/1rem` = `4/8/12/16px`) — many actually *do* match (`4px`=`--space-1`,
  `8px`=`--space-2`, `12px`=`--space-3`, `16px`=`--space-4`) but are written as raw px instead of
  the var, e.g. `graph.css:31` (`top:12px;right:12px`), `77` (`right:16px;bottom:16px`), `104`
  (`right:64px` — not a token multiple, positioning offset), `111` (`margin-bottom:8px`). These
  are drop-in token swaps, not new tokens.

## D. Top 3 consolidation opportunities

1. **Adopt `--shadow-panel` and add the missing overlay/white-on-accent tokens, fix the
   `.gv-detail` light-mode shadow bug** — effort: **drop-in**. Swap `graph.css:61` to
   `var(--shadow-panel)` (fixes a real light-theme regression, not just cleanup), swap
   `graph.css:17`'s `#fff` to a new `--color-on-accent` token once added centrally, and replace
   both `rgba(255,255,255,0.2)` border occurrences (`graph.css:71, 116`) with a new
   `--color-overlay-border` (or similar) token — all three gaps were already predicted in
   `_shared-reference.md` §1 and this view supplies concrete instances for all of them.

2. **Collapse `.gv-gear`/`.gv-fab` into one circular-icon-button primitive and dedupe
   `.gv-btn`/`.gv-mini-btn`** — effort: **needs-variant**. Four near-identical hand-rolled button
   rules (`graph.css:69-73, 80-83, 100-104, 114-117`) reduce to one circular-icon variant + one
   ghost-button variant, ideally as new `data-*` variants on `<Button>` rather than bespoke
   `.gv-*` classes, closing part of the `.btn`-proliferation pattern flagged in
   `_shared-reference.md` §3.

3. **Unify the settings-gear and filter-FAB into one `<FloatingIconPanel>` pattern, and swap
   `.gv-field`/`.gv-row`/`.gv-check` for an extended `<Field>`** — effort: **structural**.
   `GraphFilterPanel` and `GraphSettingsPanel` are two independent from-scratch implementations
   of the identical "icon button bottom-right → toggled floating options panel" shape (see B.6),
   and `GraphSettingsPanel`'s form rows (B.5) already used the name `gv-field` in apparent
   imitation of `.ui-field` without importing it. Extending `<Field>` to accept a `children` slot
   (for `<select>`/color/checkbox inputs, not just its hardcoded `<input>`) would let both panels
   drop their local field/row CSS entirely. Highest effort of the three, but removes the most
   duplicated markup+CSS in this view.

## Note on `graph.css` as a separate stylesheet

Verdict: **partially justified**. The DOM-overlay classes projected by `GraphCanvas` each frame
(`.gv-chip`, `.gv-node-label`, `.gv-area-label`, `graph.css:124-139`) are legitimately
view-specific — they're positioned via inline JS `style.left/top` per frame and only need
`graph.css` for the parts that "follow the theme" (per the file's own header comment,
`graph.css:1-5`). That part earns its own file. The rest of the file — panel shells, buttons,
form rows, toggles (§B above) — is ordinary UI chrome that re-declares patterns `primitives.css`
already has (panel, button, field) rather than anything canvas/graph-specific. None of the 4
audited components import from `src/style.css` or `src/ui/primitives.tsx`/`primitives.css` at
all (confirmed via grep) — `graph.css` is self-contained and does not lean on either shared
layer, which is the core finding: not "wrong to have graph.css" but "graph.css re-implements
primitives that already exist, instead of extending them."
