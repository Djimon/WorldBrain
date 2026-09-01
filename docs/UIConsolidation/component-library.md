# Worlds and Beyond — Component Library Index (consolidation map)

> The consolidated deliverable. For each canonical component: its role, the canonical class/primitive
> that should own it, and every hand-rolled duplicate across the six audited views with `file:line`
> occurrences and the effort to converge them. Built from the six view audits in `views/`.
>
> **Reading key — effort:** `drop-in` = swap class, no visual/logic change · `needs-variant` = primitive
> must gain a variant first · `structural` = component/markup redesign or new primitive to design.
>
> **Legend — status:** ✅ already consolidated · ⚠️ primitive exists but bypassed · ⛔ no primitive yet (must design).

Canonical layer = `src/ui/primitives.tsx` + `primitives.css` (7 primitives, currently imported in **2 of
~70** components). Everything below either extends it or feeds a new primitive.

---

## 1. Button  ⚠️  → `<Button tone>` / `.ui-button` (`primitives.tsx:46`, `primitives.css:1-24`)
**Role:** every clickable action — text, primary, danger, icon-only, FAB.
**The single most duplicated widget in the app — ~20 independent implementations across all six views.**

| Duplicate class | Occurrences (`file:line`) | View | Effort |
|---|---|---|---|
| `.btn` / `.btn--primary` / `.btn--danger` (style.css:474-509) | EntityMasterDetail:105 · EntityDetailView:361-374 · EntitySessionNotes:64 · RelationsTab:95,114,124 · CalendarWizard · CalendarLinkPanel · AudioSoundboardWindow:86 · SoundboardBoard:237 · ChannelRow:184,219 · ClipEditor:127-235 · MapViewer:1242 | all | needs-variant (add `danger` tone) |
| `.emd__create-btn` / `-confirm` / `-cancel` (style.css:551/586/596) | EntityMasterDetail:76,97,98 | entities | needs-variant (compact size) |
| `.entity-detail__edit-btn` (style.css:771) | EntityDetailView:378 | entities | needs-variant (icon-only) |
| `.cal-add-btn` / `.cal-remove-btn` (style.css:1144/1159) | CalendarWizard (3×+3×) | calendar | needs-variant (icon-only ✕) |
| `.map-viewer__controls button` (1204) · `.map-tool-btn` (2195) | MapViewer | maps | needs-variant (32px icon) |
| `.token-editor button` (1579) · `.grid-state-add/del-btn` (1893/1905) · `.grid-type-btn`/`.grid-toggle` (2371/2353) · `.pin-entity-add-btn` (2552) · `.map-pin-tree__rename-commit-btn` (2082) · `.fog-tools__btn` (3700) · `.map-folder-tree__confirm-yes/no` (3749-3765) · `.layer-panel__toolbar button` (3646) | MapViewer/MapGrid/TokenEditor/FogTools/LayerPanel | maps | needs-variant |
| `.layer-panel__controls button` (unstyled, browser default) | LayerPanel:165-201 | maps | drop-in (just apply Button) |
| `.clip-button` / `.clip-button__edit` (style.css:4231-4299) | ClipButton | audio | needs-variant (dynamic bg color + fixed tile) |
| `.gv-btn` / `--primary` (graph.css:69-73) · `.gv-mini-btn` (114-117) | GlobalGraphView/GraphFilterPanel | graph | needs-variant (translucent/glass) |
| `.gv-gear` (graph.css:80-83) · `.gv-fab`/`--filter` (100-104) | GraphSettings/FilterPanel | graph | structural (circular/FAB variant) |

**Variants `<Button>` must gain to absorb these:** `tone="danger"`, `size="compact"` + `size="icon"`
(square 32px), `shape="circle"` (FAB), and a `variant="glass"` (translucent + `backdrop-filter`, for
graph overlays). `ClipButton` stays a justified special case (per-preset color) but should still ride a
Button color-override variant. **Anti-pattern to kill:** `EntityDetailView:373` reinvents `.btn--danger`
via inline `style={{color:'var(--color-status-failure)'}}` — the class already exists.

---

## 2. List row + active/hover state  ⛔  → **new `<ListRow>` primitive (does not exist)**
**Role:** a selectable row in a list (entity list, search result, token list, layer row, channel).
**Highest-leverage gap:** ~9 implementations, no primitive to point them at. Only `<ListSurface>` (a
bare wrapper `<div>`) exists — it defines no row/active semantics.

| Duplicate class | `file:line` | View | Active-state mechanism |
|---|---|---|---|
| `.emd__item` / `--active` (style.css:628-648) | EntityMasterDetail:114 | entities | left-accent border + `color-mix` tint |
| `.gsearch__result` / `--selected` (941-956) | GlobalSearch | search | left-accent border (no tint) — **closest pair with `.emd__item`** |
| `.entity-picker__item` / `.active` (3473-3483) | EntityPicker | entities/search | flat `surface-active` bg |
| `.mention-suggest__item` (1827-1841) | PropertiesForm:138 | entities | bg-only |
| `.relations-tab__row` (3391-3401) | RelationsTab:91 | entities | none (static) |
| `.backlinks__item` (2617-2636) | BacklinksTab:53 | entities | border hover, no active |
| `.map-token-list__row` (1709-1742) | MapViewer:1079 | maps | solid accent fill + `#fff` |
| `.layer-panel__row` (3642) | LayerPanel:122 | maps | (per audit) |
| `.channel-row` (4013+) | ChannelRow | audio | candidate shape |

**Action:** design `<ListRow selected>` first (row + hover + `selected` contract, with a `layout` modifier
for grid-vs-flex), migrate the `.gsearch__result`+`.emd__item` pair first (near-identical, drop-in once the
primitive exists), then the rest. **Design it well — this pattern recurs project-wide.**

---

## 3. Form input / field  ⚠️  → `<Field>` / `.ui-field__control` (`primitives.tsx:83`, `primitives.css:69-77`)
**Role:** labeled text/number/select/search input.
**~14 implementations; 3 mutually inconsistent focus treatments; a real background-token divergence.**

| Duplicate class | `file:line` | View | Notable divergence |
|---|---|---|---|
| `.entity-detail__input` / `__textarea` (795-808) | EntityDetailView | entities | — |
| `.emd__create-input` (574-584) | EntityMasterDetail:88 | entities | — |
| `.entity-picker__input` (3451-3460) | EntityPicker:59 | entities/search | hardcoded `6px 8px` padding |
| `.cal-form__input` / `__select` (1075-1100) | Calendar (many) | calendar | **bg = `--color-background`, not `--color-surface`** |
| `.event-form-fields > input` (3157-3172) | EventFormFields | calendar | **no class at all** (element selector) |
| `.gsearch__input` (881-897) | GlobalSearch | search | has focus **ring** (others don't) |
| `.emoji-picker__search` (4500-4509) | EmojiPicker | search | **no focus style**, `surface-alt` bg |
| `.token-editor input` (1553-1566) · `.layer-panel__name-field input` (3668) · `.map-pin-tree__search` (1922) · `.map-pin-editor__name-input`/`__textarea` (2499) · `.grid-controls-panel__number-input` (2332) · `.pin-entity-add select` (2548) | maps (6×) | maps | — |
| `.gv-field` / `__label` (graph.css:89-92) | GraphSettingsPanel:69 | graph | needs `<select>`/color/checkbox — **author reused the name `gv-field` in imitation of `.ui-field`** |

**Blockers to resolve before converging:** (a) pick one background token (`--color-surface` wins — 2 of 3
already use it); (b) pick one focus treatment (ring vs border-only); (c) **`<Field>` hardcodes `<input>` —
give it a `children`/control slot** so `<select>`, color, and checkbox controls (calendar, graph, maps) fit.
**Correctness landmine (priority):** `PropertiesForm` (+`TagField`/`MentionInput`) has **no class of its
own** — it only looks styled because its one caller wraps it in `.entity-detail__props-form` (descendant
selector, style.css:818-828). Reuse it anywhere else and its fields render unstyled. Decouple it onto `<Field>`.

---

## 4. Pill / chip / badge  ⚠️  → `<StatusChip>` / `.ui-status-chip` (`primitives.tsx:100`, `primitives.css:84-106`)
**Role:** a rounded label/status/toggle pill.
**8 implementations, 3 different pill-radius magic numbers (`999px`/`100px`/`10px`), 2 hardcoded `#fff`.**
`StatusChip` today is tone-semantic (muted/success/warning/failure) and read-only — these are label chips
and clickable facets, so it needs a neutral "label" tone + a clickable/toggle variant (or a sibling `<Chip>`).

| Duplicate class | `file:line` | View | Radius |
|---|---|---|---|
| `.entity-detail__type-badge` (695-703) | EntityDetailView:358 | entities | 999px |
| `.relations-tab__badge` (3405) | RelationsTab:93 | entities | 999px |
| `.mention-chip` (1801-1812) | PropertiesForm:45 | entities | 999px |
| `.tag-field__chip` (1852-1861) | PropertiesForm:182 | entities | 999px |
| `.gsearch__facet` / `--active` (905-923) | GlobalSearch | search | 100px, toggle, `#fff` |
| `.map-token__counter` (1378-1387) | MapTokenLayer | maps | 10px, `#fff`, `rgba` shadow |
| `.layer-panel__type--image/fog/token` (3618-3620) | LayerPanel | maps | 3 hardcoded hues (`#6ea8fe`/`#b0b8c4`/`#e0a15a`) |
| `.channel-row__chip` (4013+) | ChannelRow | audio | — |

**Needs first:** `--radius-pill` token + `--color-on-accent` token (see §Tokens). Then `needs-variant` swaps.

---

## 5. Panel / card / popover shell  ⚠️  → `<Panel>` / `.ui-panel` (`primitives.tsx:50`, `primitives.css:26-35`)
**Role:** a bordered surface container (settings panel, editor, popover, dialog).

| Duplicate class | `file:line` | View | Effort |
|---|---|---|---|
| `.new-project__card` (418) | NewProjectDialog | shell | drop-in |
| `.cal-section` (1027) | CalendarWizard/LinkPanel | calendar | drop-in (lacks shadow) |
| `.token-editor` (1495) | TokenEditor | maps | needs-variant |
| `.relations-tab__add-form` (3417) | RelationsTab:126 | entities | needs-variant (`surface-alt`, `radius-sm`) |
| `.mention-suggest` (1814) | PropertiesForm | entities | needs-variant (popover + shadow + z-index) |
| `.channel-row__settings-popover` (4196-4225) | ChannelRow:158 | audio | needs-variant (popover) |
| `.clip-editor__icon-popover` (4397) | ClipEditor | audio | needs-variant (popover) |
| `.gv-panel` (84) · `.gv-filter-pane` (106) · `.gv-detail` (58) | Graph panels | graph | needs-variant (**translucent + `backdrop-filter: blur`** — glass over canvas) |

**Variants needed:** `variant="popover"` (shadow + z-index from a scale) and `variant="glass"` (translucent
+ blur). The glass difference is *motivated* (canvas must show through) — not a bug, a real variant.

---

## 6. Tabs  ⚠️  → `<Tabs>` / `.ui-tabs` (`primitives.tsx:58`, `primitives.css:37-56`)
| Duplicate class | `file:line` | View | Effort |
|---|---|---|---|
| `.cal-tabs` / `.cal-tab` (2934-2960) | CalendarWizard:230 | calendar | **drop-in** (API matches 1:1) |
| `.entity-detail__tab` (705-724) | EntityDetailView:381 | entities | structural (per-tab `render()` fn) |
| `.maps-sidebar-tabs__tab` + `.map-side-collapsed__tab` | MapsSidebarTabs | maps | needs-variant (collapsed/vertical mode) |
| `.gv-layout-toggle__btn` (graph.css:23-38) + dead `.gv-segbar__btn` | GlobalGraphView | graph | needs-variant (`role=group`/`aria-pressed`, not tablist) |

Plus a **component-level** dup: `MapViewer` re-authors `MapsSidebarTabs`'s whole expanded+collapsed tab strip
by hand (MapViewer:1052-1072) instead of reusing the component — fold it back in (`drop-in`, generalize the
Karten/Ebenen pair to a `tabs` prop).

---

## 7. Tree  ✅  → `NestedTree` (`src/ui/NestedTree.tsx`) — **already consolidated; the model to copy**
`NestedTree` **is** the gold-standard pin tree (emits `.map-pin-tree__*` directly). Reused by `MapFolderTree`
(folders, `fromParentId` adapter) and `MapViewer` (pins, `fromPathStrings` adapter) — one implementation, two
adapters, shared CSS. **Do not change it.** This is the exact end-state every other cluster above should reach.
*Only gap:* `MapFolderTree`'s delete-confirm dialog isn't reused by `MapViewer`'s copy (extract one shared helper).

---

## 8. Icon / emoji picker  ⚠️ (partially shared)
- `EmojiPicker` (`.emoji-picker*`, 4 consumers) — ✅ properly shared, token-clean.
- `IconPicker` (`.icon-picker*`, used by TokenEditor) — good, but **`MapViewer` reinvents it** as an inline
  pin-icon grid (`.pin-icon-picker`/`.pin-icon-btn`, style.css:1865-1891). Converge by registering `PIN_ICONS`
  as an icon set and using `<IconPicker>` (`needs-variant` — 36px vs 32px).

---

## 9. Floating-icon-panel (interaction pattern)  ⛔ → new `<FloatingIconPanel>`
Graph builds the "bottom-right icon button → toggled floating panel" twice from scratch (`GraphFilterPanel`
funnel-FAB and `GraphSettingsPanel` gear, 12px apart on screen). One shared wrapper would serve both. `structural`.

---

## Cross-cutting: token gaps every view re-hardcodes
These recur in **all six** audits — adding them is the highest-ROI, lowest-risk first move (and the foundation
for community theming, see `_theming-community-themes.md`).

| Missing token | What it replaces | Sample occurrences |
|---|---|---|
| `--color-on-accent` | `#fff` on accent/danger fills (~15+×) | entities 493/563/591 · calendar 1156/1173/2749/2855/3062 · search 918 · audio 4052/4150/4193/4243 · graph.css:17 · maps (many) |
| `--color-scrim` | `rgba(0,0,0,0.6)` label/coord scrims | maps 1229/1275/1360 · map-token (several) |
| `--color-overlay-border` | `rgba(255,255,255,0.2)` glass borders | graph.css:71,116 |
| `--radius-pill` | `999px`/`100px`/`10px` pill radii | entities (4×) · search 908 · tag-field 1856 · map-token 1383 |
| adopt `--shadow-panel` | hardcoded shadows | **graph.css:61 (real light-mode bug)** · calendar 2705 |
| `--space-5` + use tokens for raw px radii/gaps | `6px`/`8px`/`10px`/`20px` literals | graph.css (many) · calendar (many) |

**Also fix:** the `.btn--danger` `#c0392b` fallback (style.css:502-503) matches *neither* theme's
`--color-status-failure` (`#9f3a2e`/`#e06b6b`) — a dead fallback that silently drifts from the design.
