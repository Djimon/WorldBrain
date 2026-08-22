# Maps View — UI Consolidation Audit

Scope as given: `src/ui/MapViewer.tsx`, `MapGrid.tsx`, `MapFolderTree.tsx`, `MapsSidebarTabs.tsx`,
`MapTokenLayer.tsx`, `TokenEditor.tsx`, `FogTools.tsx`, `FogMaskCanvas.tsx`, `LayerPanel.tsx`,
`SceneSwitcher.tsx`, `NestedTree.tsx`, `IconPicker.tsx`.

**Scope correction**: `SceneSwitcher.tsx` is **not** a Maps component — its own header comment
says "M15-S15 (#286): scene list/switcher … `audio_scenes`", it uses `.scene-switcher*` classes
(CSS at `style.css:3814+`, Audio Soundboard block) and `.btn`/`.btn--primary`/`.btn--danger`, and
it is imported only by `src/ui/AudioSoundboardWindow.tsx` (verified via grep — zero references
from any Maps file). It shares no CSS, no tree/tab pattern, nothing with the Maps view. Already
covered by `docs/UIConsolidation/views/audio.md`. Excluded from the analysis below.

The Maps CSS is **not** confined to the 6 named blocks — it spans a much larger, non-contiguous
set of regions in `src/style.css`: Map Viewer (1176), Map tokens (1323), Token editor panel
(1494), Right map sidebar (1667), Pin tree sidebar (1753), Pin Icon Picker (1864), Map Toolbar
(2147), Tool group flyout (2212), Grid Controls Panel (2252), Map Context Menu (2416), Pin Editor
(2459), Pin Entity Links (2534), Maps sidebar/layer panel (3488), Fog paint toolbar (3680), and
IconPicker popover (4422). All of these were read and are catalogued below.

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `MapViewer` (`src/ui/MapViewer.tsx:156`) | Root of the Maps canvas: pan/zoom stage, mode state machine (navigate/pin/token/grid/measure/radius), owns pin + token CRUD, mounts every other Maps sub-component | View-specific (1275-line god-component: canvas, toolbar, pin editor, right sidebar, and 2 tab strips are all inlined here rather than split into files) | No — only `src/ui/WorkspaceShell.tsx:28` | `.map-viewer`, `.map-viewer__stage`, `.map-viewer__controls`, `.map-viewer__coords`, `.map-viewer__hint`, `.map-empty` | Local, single-consumer | `#111` inline background (`MapViewer.tsx:827`, the canvas backdrop — no token for a near-black stage color); `#fff` (`style.css:1221,1230,1244`) |
| `MeasureOverlay` / `RadiusOverlay` (`MapViewer.tsx:~80`, `:125`) | SVG ruler/radius-measurement overlays drawn over the map | View-specific | No | none (raw `<svg>`/`<rect>`/`<line>`, no className) | n/a — pure SVG, zero CSS classes | `rgba(0,0,0,0.75)` label background (`MapViewer.tsx:119,150`, hand-set on every render, duplicated verbatim between the two overlays) |
| Map toolbar + tool groups + flyouts (inline in `MapViewer.tsx:726-824`) | Left vertical tool rail: mode buttons, PS-style flyout for measure/radius and grid-cell-state, grid settings button | View-specific | No | `.map-toolbar`, `.map-toolbar__group`, `.map-tool-btn`, `.map-tool-group`, `.map-tool-group__arrow`, `.map-tool-flyout`, `.map-tool-flyout__item`, `.map-tool-flyout__icon`, `.map-tool-flyout__label` | Local (`style.css:2147-2251`), single-consumer | `rgba(255,255,255,0.3)` swatch border (`MapViewer.tsx:750,772`, inline, 2x duplicated); `#fff` active-state text (`style.css:2210`) |
| Pin layer, Pin Editor, pin-icon-picker (inline in `MapViewer.tsx:935-1246`) | Renders `.map-pin` markers, the pin edit side-panel (name/notes/visibility/entity-links), and a **hand-rolled** icon-grid for choosing the pin's emoji | View-specific | No | `.map-pin`, `.map-pin__label`, `.map-pin__icon`, `.map-pin__move-btn`, `.map-pin__vis-badge`, `.map-pin-editor*`, `.pin-icon-picker`, `.pin-icon-btn`, `.pin-entity-*`, `.btn`/`.btn--primary` (footer save/delete, `:1242-1243`) | Local, single-consumer, except the `.btn`/`.btn--primary` footer buttons which reuse the **generic** app button class (yet nothing else in the pin editor does — see B1) | `#fff` (`style.css:1221,1230,1244,1276,1309,2133`); `rgba(0,0,0,0.6)` coord scrim (`1229`); `rgba(0,0,0,0.65)` (`1275,1360`); `rgba(0,0,0,0.75)` (`2132`, **2nd definition of `.map-pin__label`**, see C) |
| Right sidebar: Pins/Token tabs + token list (inline in `MapViewer.tsx:1052-1160`) | Hand-rolled duplicate of `MapsSidebarTabs`' expanded-tabs + collapsed-vertical-strip pattern, but for Pins/Token instead of Karten/Ebenen | View-specific | No | `.maps-sidebar-tabs__list`, `.maps-sidebar-tabs__tab`, `.maps-sidebar-tabs__tab--active`, `.map-side-collapsed`, `.map-side-collapsed__tab`, `.map-side-collapse-btn`, `.map-token-list`, `.map-token-list__row`, `.map-token-list__swatch`, `.map-token-list__name`, `.map-token-list__del` | Shared class names (same as `MapsSidebarTabs.tsx`) but the **JSX is independently re-authored here**, not imported (see B4) | `#fff` active row (`style.css:1742`); `rgba(255,255,255,0.6)` swatch border (`1720`) |
| `GridControlsPanel` (`src/ui/MapGrid.tsx:274`) | Popover: grid color/opacity/size/type/line-style, per-cell-state palette editor, measurement scale, ruler style | View-specific | No — only `MapViewer.tsx:814` | `.grid-controls-wrap`, `.grid-controls-panel*`, `.grid-color-swatch`, `.grid-color-picker`, `.grid-toggle`, `.grid-type-btn(s)`, `.grid-state-name`, `.grid-state-add-btn`, `.grid-state-del-btn`, `.btn` (footer "all", `:460`) | Local (`style.css:2252-2415`), single-consumer | `PRESETS` hex array `#000000/#ffffff/#ff8800/#44aaff` (`MapGrid.tsx:271`, inline swatches); `#666` border (`:316`); `#fff` active states (`style.css:2366,2381`) |
| `GridLayer` / `CellStateLayer` / `PaintInteractionLayer` (`MapGrid.tsx:64/123/180`) | Canvas/SVG grid-line rendering, painted-cell overlay, pointer-paint interaction — 3 stacked pure-rendering layers | View-specific | No | none — raw `<canvas>`/`<svg>`, all styling via inline `style={{}}` | n/a — zero CSS classes | `DEFAULT_GRID_SETTINGS` hex: `#ffffff, #4a9eff, #ff4a4a, #4aff7a, #aaaaaa, #ffe066` (`MapGrid.tsx:34-49`) — cell-state and ruler defaults, all inline, none token-derived |
| `CellContextMenu` (`MapGrid.tsx:495`) | Right-click menu on a grid cell to assign a cell-state | View-specific | No — only `MapViewer.tsx:1262` | `.map-context-menu`, `.map-context-menu__title`, `.map-context-menu__item`, `.map-context-menu__item--off` (undefined in CSS, see C), `.map-context-menu__dot` | Local (`style.css:2416-2457`), single-consumer | `#666` dot border, inline (`MapGrid.tsx:504`) |
| `MapFolderTree` (`src/ui/MapFolderTree.tsx:40`) | Thin adapter: fetches folders via `map-folder-service`, converts to `TreeNode[]` (via `fromParentId`), delegates **all** rendering to `NestedTree` | Generic **shape** (folder tree over any parent-linked item), currently Maps-specific only via its service calls | No — only `WorkspaceShell.tsx:32` | `.map-folder-tree`, `.map-folder-tree__confirm-dialog`, `.map-folder-tree__confirm-text`, `.map-folder-tree__confirm-actions`, `.map-folder-tree__confirm-yes/no`, `.map-folder-tree__map-title`; plus everything `NestedTree` renders (`.map-pin-tree*`) | Local for the confirm-dialog subset; **shares** `.map-pin-tree__*` with the pin tree via `NestedTree` (see B3 — this is the *good* pattern) | none |
| `MapsSidebarTabs` (`src/ui/MapsSidebarTabs.tsx:28`) | "Karten"/"Ebenen" tab switcher wrapping the map list vs. `LayerPanel`; auto-jumps to Ebenen on map select; collapsible to a vertical strip | Generic **shape** (tab-strip + collapse), Maps-specific wiring only | No — only `WorkspaceShell.tsx:31` | `.maps-sidebar-tabs`, `.maps-sidebar-tabs__list`, `.maps-sidebar-tabs__tab`, `.maps-sidebar-tabs__tab--active`, `.maps-sidebar-tabs__panel`, `.map-side-collapsed`, `.map-side-collapsed__tab`, `.map-side-collapse-btn` | Local, but **duplicated verbatim** by `MapViewer`'s own Pins/Token tab strip instead of being reused (see B4) | none |
| `MapToken` (`src/ui/MapTokenLayer.tsx:60`) | One token on the map: ring/plain art render, status-chip orbit, counter stepper, resize handle | View-specific | No — only `MapViewer.tsx:980` | `.map-token`, `.map-token__ring`, `.map-token__portrait`, `.map-token__name`, `.map-token__footer`, `.map-token__counter*`, `.map-token__chips*`, `.map-token__chip`, `.map-token__art*`, `.map-token__resize` | Local (`style.css:1323-1493`), single-consumer | `DEFAULT_RING = 'var(--color-accent, #6ea8fe)'` (`:54`, hex fallback); chip color default `'#fff'` (`:112`); CSS: `#fff` x4, `rgba(0,0,0,0.6)` x3, `rgba(0,0,0,0.65)`, `rgba(0,0,0,0.7)` text-shadow, `rgba(0,0,0,0.8)` x5 (chip glyph drop-shadow stack), `rgba(0,0,0,0.5)`; `var(--color-accent-strong, #c0392b)` fallback |
| `TokenEditor` (`src/ui/TokenEditor.tsx:52`) | Side panel: token name, art upload + crop, ring color, counter, up to 12 status chips (each with an `IconPicker` popover) | View-specific | No — only `MapViewer.tsx:1250` | `.token-editor`, `.token-editor__header/field/art/counter/chips/mode*/upload/crop/plain-preview/chip-row/chip-icon-trigger/chip-icon-popover/add-chip/counter-clear/actions/save/delete`, raw `button`/`input`/`select` element selectors | Local (`style.css:1494-1666`), single-consumer; **one of ~10 independent button conventions** in this view (see B1) | ring default `'#6ea8fe'` (`:55`); chip color default `'#ffffff'` (`:213`); CSS: `#fff` x3 (`1593,1664`), `rgba(0,0,0,0.4)` x2, `var(--color-status-failure, #c0392b)` fallback x3 |
| `FogTools` (`src/ui/FogTools.tsx:33`) | Pure controls toolbar: brush/square/region/grid-stamp shape, reveal/cover mode, brush size + feather sliders | Generic **shape** (segmented-button toolbar), Maps-specific data | No — only `MapViewer.tsx:847` | `.fog-tools`, `.fog-tools__group`, `.fog-tools__btn`, `.fog-tools__stamp-levels` (undefined in CSS, see C), `.fog-tools__slider`, `.fog-tools__value` | Local (`style.css:3680-3730`), single-consumer | `rgba(0,0,0,0.4)` box-shadow (`3690`) |
| `FogMaskCanvas` (`src/ui/FogMaskCanvas.tsx:30`) | `<canvas>` paint surface for the fog mask; brush/square/region/grid-stamp dabs, hover previews | View-specific | No — only `MapViewer.tsx:890` | `.fog-mask-canvas`, `.fog-brush-preview`, `.fog-region-preview`, `.fog-grid-stamp-preview__cell` (all styled almost entirely via inline `style={{}}`, not CSS) | Local, single-consumer | `'#000'` fill/shadow color x2 (`:72,78,89`, `paintOp`/`stampBrush`/`stampSquare`); `rgba(255,255,255,0.9)` border x3; `rgba(0,0,0,0.6)` box-shadow x3; `rgba(255,255,255,0.08)` fill x2 — **all inline**, none of it lives in `style.css` at all |
| `LayerPanel` (`src/ui/LayerPanel.tsx:38`) | Ordered layer list (image/fog, token layers excluded): visibility, player-visibility, opacity slider, rename, reorder, fog-edit / image-move toggle, delete-with-confirm | View-specific | No — only `WorkspaceShell.tsx:30` | `.layer-panel`, `.layer-panel__toolbar`, `.layer-panel__list`, `.layer-panel__row`, `.layer-panel__row-header`, `.layer-panel__collapse`, `.layer-panel__name-display`, `.layer-panel__hidden-indicator`, `.layer-panel__type(--image/--fog/--token)`, `.layer-panel__controls`, `.layer-panel__name-field`, `.layer-panel__opacity`, `.layer-panel__delete-confirm` (undefined in CSS, see C), raw `button` elements (unstyled — no `.btn`/`.ui-button`, see B1) | Local (`style.css:3488-3679` + `2252` region), single-consumer | `.layer-panel__type--image { color: #6ea8fe }`, `--fog { color: #b0b8c4 }`, `--token { color: #e0a15a }` (`style.css:3618-3620`) — **3 new hex colors with no token equivalent**, not reused anywhere else |
| `NestedTree` + `FolderNode` (`src/ui/NestedTree.tsx:243`, `:82`) | Generic drag/drop folder tree with rename, color, search, persisted collapse state — **this is the literal implementation of the gold-standard pin tree**, not a lookalike | Generic (parametrized over `TreeNode[]`/`renderItem`) | **Yes** — by both `MapFolderTree.tsx` (folders, via `fromParentId`) and `MapViewer.tsx:1115` (pins, via `fromPathStrings`) | `.map-pin-tree`, `.map-pin-tree__resize-handle`, `--collapsed`, `.map-pin-tree__collapse-btn`, `__collapsed-label`, `__group-header`, `__group-arrow`, `__group-name`, `__group-count`, `__group-menu*`, `__color-input`, `__color-swatch*`, `__rename-input`, `__rename-commit-btn*`, `__item*`, `__label`, `__sub`, `__search*`, `__list`, `__empty`, `__new-folder-btn/row`, `.map-pin-editor__header` (reused for the tree's own header row, `:364`) | **Shared** — the single source of the `.map-pin-tree__*` gold-standard classes; both consumers point at the same CSS | `FOLDER_COLORS` hex array `#dedede,#ef9a9a,#a5d6a7,#90caf9,#ce93d8,#424242` (`:64`) + `DEFAULT_FOLDER_COLOR = '#f0c674'` (`:65`), all inline swatch styles |
| `IconPicker` (`src/ui/IconPicker.tsx:28`) | Grid popover of icons grouped by icon-set, with jump-to-group tabs | Generic (data comes from `icon-set-registry`, zero Maps coupling in the component itself) | Only 1 real consumer — `TokenEditor.tsx:197` (status chips). **Not** used by `MapViewer`'s own pin-icon-picker, which reinvents the identical pattern by hand (see B2) | `.icon-picker`, `.icon-picker__tabs`, `.icon-picker__tab`, `.icon-picker__groups`, `.icon-picker__group(-label)`, `.icon-picker__grid`, `.icon-picker__icon`, `.icon-picker__glyph` | Local (`style.css:4422-4487`) | none — fully token-based |

## B. Duplication & similarity findings

### B1. Buttons — the worst offender in this view

The Maps view alone hand-rolls **at least nine** independent button conventions, none of which
is the `<Button>`/`.ui-button` primitive (§2 of the shared reference):

- `.map-viewer__controls button` (`style.css:1204`) — 32×32 icon button, hover→accent+`#fff`
- `.map-tool-btn` (`2195`) — near-identical 32×32 icon button, separate class, separate rule
- `.token-editor button` (`1579`) — bordered text button, `:hover` border→accent
- `.map-folder-tree__confirm-dialog button` (`1951`, first def) / `.map-folder-tree__confirm-yes`
  `/--no` (`3749-3765`, second def) — two different button treatments for what is nominally the
  same confirm dialog (see B5/C for the duplicate-definition angle)
- `.grid-state-add-btn` / `.grid-state-del-btn` (`1893`, `1905`) — pill-shaped vs. plain-text
- `.grid-type-btn` / `.grid-toggle` (`2371`, `2353`) — two more variants inside the same panel
- `.pin-entity-add-btn` (`2552`)
- `.map-pin-tree__rename-commit-btn` (+`--save`, `2082`)
- `.fog-tools__btn` (`3700`) — segmented-group button
- `.layer-panel__toolbar button` (`3646`) styled, but the row-action buttons inside
  `.layer-panel__controls` (visibility/move/delete, `LayerPanel.tsx:165-201`) are **entirely
  unstyled** — no class, no `.btn`, browser default `<button>` chrome
- On top of all of the above, `MapViewer.tsx:1242-1243` uses the **generic** `.btn`/`.btn--primary`
  classes for the pin editor's Save/Delete — the one place in the whole view that *does* touch
  the app-wide button system, inconsistently.

Every one of these reimplements "bordered box, `--color-border`, hover→`--color-accent`,
active/selected→accent background + `#fff` text" — exactly the `.ui-button[data-tone]` contract.
Consolidating to `<Button>` with a `tone` + an icon-only size variant would fold most of these
into one component; the drag-and-drop-adjacent ones (grid palette rows, layer rows) are
needs-variant (icon-only 32px square vs. text-padded), not pure drop-in.

### B2. Icon-grid picker — near-identical component reinvented once

`IconPicker.tsx` (`.icon-picker__grid` / `.icon-picker__icon`, `style.css:4462-4485`, 32×32
bordered button, `aria-pressed`→accent border + `--color-accent-soft` fill) and `MapViewer.tsx`'s
inline pin-icon-picker (`.pin-icon-picker` / `.pin-icon-btn`, `style.css:1865-1891`, 36×36
bordered button, `.active`→accent border + `color-mix(accent 15%)` fill) are the **same pattern**
— a flex-wrapped grid of square icon-toggle buttons with an active/pressed state — built twice,
7 lines apart in intent, in two different files. `TokenEditor.tsx` already proves the componentized
version works for a Maps use case (status chips); `MapViewer`'s own pin emoji picker (`PIN_ICONS`,
`:1168-1177`) never adopted it. **Needs-variant** (button size differs, 36px vs 32px, and pin
icons are a fixed local array vs. `IconPicker`'s registry-driven sets) but structurally a strong
consolidation candidate — likely just needs `PIN_ICONS` registered as an icon set.

### B3. Tree systems — NOT a duplication (assessed per the task's instruction)

The task asked to check whether `NestedTree.tsx` / `MapFolderTree.tsx` duplicate the gold-standard
pin tree. They do not — **`NestedTree.tsx` *is* the pin tree.** Its `FolderNode`/`NestedTree`
render function emits `.map-pin-tree`, `.map-pin-tree__group-header`, `.map-pin-tree__item`, etc.
directly (`NestedTree.tsx:124,130,137,143,226` and more). `MapViewer.tsx:1115` calls
`<NestedTree>` with pin data via the `fromPathStrings` adapter; `MapFolderTree.tsx:128` calls the
same `<NestedTree>` with folder data via the `fromParentId` adapter. One render implementation,
two adapters, shared CSS — this is already the target end-state the rest of the app should copy,
not a defect to fix.

The one real gap: `MapFolderTree.tsx`'s delete-confirmation dialog (`:105-125`, uses
`.map-folder-tree__confirm-text/__confirm-actions/__confirm-yes/__confirm-no`) is **not** reused
by `MapViewer.tsx`'s own pin-folder delete confirmation (`:1098-1113`), which reimplements the
same "delete this folder?" dialog with a raw `<p>` and two plain unstyled `<button>`s inside the
same `.map-folder-tree__confirm-dialog` wrapper class. Same container class, divergent internals
— a drop-in fix (extract the confirm-dialog body into one shared function/component).

### B4. Tab systems — `MapsSidebarTabs` duplicated by hand inside `MapViewer`

`MapsSidebarTabs.tsx` is exactly the abstraction needed here: expanded tab-list + collapsible
vertical-strip fallback (`:40-88`). `MapViewer.tsx`'s right sidebar (`:1052-1072`) reimplements
the identical structure — same `.maps-sidebar-tabs__list`/`__tab`/`--active` classes, same
`.map-side-collapsed`/`__tab` collapsed variant, same collapse-button — for Pins/Token instead
of Karten/Ebenen, without importing or reusing `<MapsSidebarTabs>` at all. This is a **drop-in**
opportunity: `<MapsSidebarTabs mapsTabContent={...} layersTabContent={...}>` already accepts
arbitrary `ReactNode` panels; the same component (perhaps generalized to accept a `tabs: TabOption[]`
list instead of a hardcoded Karten/Ebenen pair) could serve both call sites.

Separately, neither tab system touches the `.ui-tabs`/`<Tabs>` primitive (§2), which already
implements "row of buttons, `aria-selected` → accent bottom-border" — the same contract as
`.maps-sidebar-tabs__tab--active`. A `<Tabs>` variant with an optional collapsed/vertical mode
could absorb both.

### B5. List row with active state

`.map-token-list__row` (`MapViewer.tsx:1079`, `style.css:1709`), `.map-pin-tree__item` (via
`NestedTree`, `2107`), `.layer-panel__row` (`LayerPanel.tsx:122`, `3642`), and the now-dead
`.map-folder-tree__map-row--active` (`3789`, see C) all reimplement "row, hover→surface-hover,
active→accent background or left-accent" independently, matching the shared-reference's
already-flagged cross-view pattern (`emd__item`, `gsearch__result`, etc.). No two of the four in
this view share markup; each is a small (~10-20 line) local rule block, so this is a
needs-variant consolidation rather than structural.

### B6. Form inputs

`.token-editor input[type="text/number"]`/`select` (`style.css:1553-1566`), `.layer-panel__name-field
input` (`3668-3678`), `.map-pin-tree__search` (`1922-1930`), `.map-pin-editor__name-input`/`__textarea`
(`2499-2532`), `.grid-controls-panel__number-input` (`2332-2351`), `.pin-entity-add select`
(`2548-2551`) all independently declare the same "surface bg, `--color-border`, `--radius-sm`,
focus→accent border" recipe the shared reference already names as a `.ui-field`-equivalent
pattern (`--color-border`/`--radius-sm`/accent-focus repeated 6 times in this view alone). Drop-in
for the plain text/number cases; the color-swatch and range-slider inputs need a variant.

## C. CSS hygiene

**Duplicate class definitions** (same selector, two separate rule blocks with diverging content —
not just repeated but genuinely inconsistent):
- `.map-pin__label` defined twice: `style.css:1273-1281` (`background: rgba(0,0,0,0.65)`, no
  transition, always visible) and again at `2127-2141` (`background: rgba(0,0,0,0.75)`, `opacity:
  0` + hover-reveal transition). The second definition wins in cascade order and silently
  overrides the first, which is effectively dead — but a reader scanning from the top would see
  the wrong (dead) behavior first, and any edit to the first block has zero effect.
- `.map-folder-tree__confirm-dialog` defined twice: `1939-1943` (bare flex column, combined
  selector with `.map-folder-tree`) and again at `3738-3746` (adds `padding`, `border`,
  `background`). Both apply (they don't fully overlap), but splitting one class's rules across
  two non-adjacent blocks 1800 lines apart is a maintenance trap.

**Dead CSS** (classes with zero matching `className=` anywhere in `src/`, verified by grep):
- `.map-folder-tree__new-folder-btn` (`3732-3735`)
- `.map-folder-tree__root` (`3768-3772`)
- `.map-folder-tree__folder-row`, `.map-folder-tree__map-row`, `.map-folder-tree__map-row--active`,
  `.map-folder-tree__folder-name`, `.map-folder-tree__folder-row select`/`.map-folder-tree__map-row
  select`, `.map-folder-tree__folder-row button` (`3774-3812`)

  All ~50 lines above are leftovers from before `MapFolderTree.tsx` was refactored into a thin
  `NestedTree` adapter (its own header comment confirms: "dünner Adapter, keine eigene
  Baum-Logik" — no own tree markup). The component no longer renders any `__folder-row`/
  `__map-row` markup; `NestedTree`'s `.map-pin-tree__*` classes took over that job.

**Classes used in JSX with no matching CSS rule** (harmless — they inherit from a sibling class
on the same element — but dead weight / naming debt):
- `.pin-entity-add__select` (`MapViewer.tsx:1220`) — only `.pin-entity-add select` (element
  selector) exists in CSS
- `.map-context-menu__item--off` (`MapGrid.tsx:503`) — no matching rule
- `.fog-tools__stamp-levels` (`FogTools.tsx:65`) — no matching rule
- `.layer-panel__delete-confirm` (`LayerPanel.tsx:194`) — no matching rule

**Hardcoded colors with no token equivalent** (beyond the routine `#fff`-on-accent and
`rgba(0,0,0,0.6)` scrim cases already flagged app-wide in the shared reference):
- `.layer-panel__type--image/--fog/--token` (`style.css:3618-3620`): `#6ea8fe`, `#b0b8c4`,
  `#e0a15a` — three brand-new hues introduced solely for these 3 pills, no reuse elsewhere, no
  status/accent token fits their intent (layer-type categorization, not success/warning/failure)
- `DEFAULT_GRID_SETTINGS` (`MapGrid.tsx:34-49`): `#ffffff, #4a9eff, #ff4a4a, #4aff7a, #aaaaaa,
  #ffe066` — cell-state and ruler default colors, all inline, all outside `tokens.css`
- `FOLDER_COLORS` (`NestedTree.tsx:64`) + `DEFAULT_FOLDER_COLOR` (`:65`): 7 more hex values,
  inline swatch styles, same story
- `GridControlsPanel`'s `PRESETS` (`MapGrid.tsx:271`): `#000000, #ffffff, #ff8800, #44aaff`

**Inline-style-only components** (zero CSS-class footprint, entire visual defined via `style={{}}`
in the `.tsx` file, invisible to any future "search style.css for the color" audit):
`MeasureOverlay`/`RadiusOverlay` (SVG), `GridLayer`/`CellStateLayer`/`PaintInteractionLayer`
(canvas/SVG), most of `FogMaskCanvas`'s preview overlays (`.fog-brush-preview`,
`.fog-region-preview`, `.fog-grid-stamp-preview__cell` all carry a class but every actual
color/border/shadow value is inline on the element, not in the class rule).

**`!important`**: none found in the Maps-relevant blocks (the one `!important` in the searched
range, `style.css:1134`, belongs to the Calendar month view, not Maps).

## D. Top 3 consolidation opportunities for this view

1. **Fold `MapViewer`'s hand-rolled Pins/Token tab strip into `<MapsSidebarTabs>`** (B4). The
   component already exists, already implements expanded+collapsed variants, and is one prop
   change away from serving both call sites (generalize the hardcoded Karten/Ebenen pair to a
   `tabs` prop). Removes ~20 duplicated lines of JSX from `MapViewer.tsx` and guarantees the two
   tab strips can never drift apart again. **Effort: drop-in to needs-variant** (small prop-shape
   change to `MapsSidebarTabsProps`).

2. **Unify the ~9 button conventions onto `<Button tone>`** (B1). Highest volume of duplicated
   CSS in the view (9+ independent rule blocks, all reimplementing the same border/hover/active
   contract) and the most visible inconsistency (one lone `.btn`/`.btn--primary` usage sitting
   next to eight other conventions in the same view). **Effort: structural** — needs an icon-only
   size variant and a way to express "active/pressed" beyond `tone`, but the payoff is the
   largest single CSS-line reduction available in this view.

3. **Clean up `MapFolderTree`'s dead CSS + reconcile its confirm-dialog with `MapViewer`'s copy**
   (C, B3). Delete the ~50 lines of pre-refactor `.map-folder-tree__folder-row`/`__map-row`/`__root`/
   `__new-folder-btn` rules (verified zero JSX matches), collapse the duplicate `.map-pin__label`
   and `.map-folder-tree__confirm-dialog` rule blocks into one definition each, and extract the
   folder-delete confirm dialog body (text + 2 buttons) into one function both `MapFolderTree.tsx`
   and `MapViewer.tsx` call. **Effort: drop-in** (pure deletion + one small shared helper) — the
   cheapest win in this audit, and removes the "two definitions, easy to fix the wrong one" trap
   most likely to bite someone during the consolidation pass itself.

Runner-up worth flagging even though it didn't make the top 3: wiring `MapViewer`'s pin-icon-picker
through the existing `<IconPicker>` component (B2) instead of a second hand-rolled icon grid —
held back from the top 3 only because it needs the pin emoji set registered in
`icon-set-registry.ts` first (needs-variant, not pure drop-in).
