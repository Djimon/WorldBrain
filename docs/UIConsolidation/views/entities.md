# Entities View — UI Consolidation Audit

Scope: `src/ui/{EntityMasterDetail,EntityDetailView,EntityTable,EntityReadingView,EntitySessionNotes,EntityStatusBadge,EntityPicker,PropertiesForm,DefaultFormGenerator,RelationsTab,BacklinksTab,CardList,CardPreview,CardCreationFlow,BodyEditor}.tsx`.
CSS: `src/style.css` blocks "Entity Master Detail" (517–670), "Entity Detail View" (672–850), "Backlinks tab" (2607–2653), "#292 follow-up: RelationsTab + EntityPicker" (3376–3486), "@ Mentions" (1800–1862).

**Mount-tree reality check** (grepped every `import … from` across `src/`): only `EntityMasterDetail`, `EntityDetailView`, `CardList`, `CardCreationFlow` are mounted from `WorkspaceShell.tsx`; `EntityDetailView` is additionally reused from `GlobalGraphView.tsx`. `RelationsTab`/`BacklinksTab` are mounted indirectly via `registerEntityTab()` in `src/tab-wiring.tsx`. `EntityTable`, `EntityReadingView`, `EntitySessionNotes`, `EntityStatusBadge`, `DefaultFormGenerator`, `CardPreview`, `BodyEditor` have **zero** consumers anywhere in `src/` — each is exercised only by its own `*.dom.test.tsx`. They are cataloged below as-is (not treated as dead-wiring bugs — per the p-level convention, an unbuilt/unwired story is expected to have 0 mounts).

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `EntityMasterDetail` (`src/ui/EntityMasterDetail.tsx:31`) | List+detail split view for one entity type: list pane, inline create form, selection → detail pane | View-specific composition root | No — 1 mount (`WorkspaceShell.tsx:406`) | `.emd`, `.emd__list`, `.emd__list-header`, `.emd__list-count`, `.emd__create-btn`, `.emd__create-form`, `.emd__create-input`, `.emd__create-confirm`, `.emd__create-cancel`, `.emd__empty`, `.emd__items`, `.emd__item`, `.emd__item--active`, `.emd__item-title`, `.emd__item-summary`, `.emd__detail`, `.emd__detail-empty`, plus legacy `.btn.btn--primary` (line 105) | Local (`emd__*` only defined/used here) | None in TSX; CSS has `#fff` at style.css:563, :591 |
| `EntityDetailView` (`src/ui/EntityDetailView.tsx:66`) | Single-entity detail: header, tabs (static "overview" + `registerEntityTab`-injected), view/edit mode, delete confirm | Generic (schema-driven, type-agnostic) | Yes — 3 mounts: inside `EntityMasterDetail` (line 128), inline in `WorkspaceShell.tsx:648` (calendar day panel), `GlobalGraphView.tsx:361` | `.entity-detail`, `.entity-detail__header`, `.entity-detail__name`, `.entity-detail__type-badge`, `.entity-detail__tabs`, `.entity-detail__tab`, `.entity-detail__body`, `.entity-detail__overview`, `.entity-detail__field*`, `.entity-detail__summary(--md)`, `.entity-detail__properties`, `.entity-detail__prop-*`, `.entity-detail__edit-btn`, `.entity-detail__delete-confirm`, `.entity-detail__title-input`, `.entity-detail__edit-form`, `.entity-detail__input`, `.entity-detail__textarea`, `.entity-detail__props-form`, plus `.btn` / `.btn.btn--primary` (lines 361–374) | Local (`entity-detail__*` only defined/used here) | Inline styles at lines 361, 363, 368, 373 (`style={{ color: 'var(--color-status-failure)' }}` etc.) — token used correctly but bypasses the existing `.btn--danger` class entirely |
| `EntityTable` (`src/ui/EntityTable.tsx:17`) | Schema-driven sortable/filterable spreadsheet view of one entity type, inline cell edit | Generic in design (schema-driven) | No — 0 consumers, test-only | **None** — every element (`<table>`, `<th>`, `<td>`, `<button>`, `<select>`) is unstyled, no `className` anywhere | N/A (unstyled) | None |
| `EntityReadingView` (`src/ui/EntityReadingView.tsx:36`) | Read-only rendering of an entity's `body.blocks` (portable-blocks) with Back/Edit buttons | Generic (block renderer) | No — 0 consumers, test-only | **None** — no `className` anywhere | N/A (unstyled) | None |
| `EntitySessionNotes` (`src/ui/EntitySessionNotes.tsx:19`) | Collapsible session-note capture on an entity, logs to session log | View-specific (GM session workflow) | No — 0 consumers, test-only | `.entity-session-notes`, `.entity-session-notes__toggle`, `.entity-session-notes__body`, `.btn` | **None of the 3 `entity-session-notes*` classes exist in `style.css`** — component is effectively unstyled in practice | None |
| `EntityStatusBadge` (`src/ui/EntityStatusBadge.tsx:15`) | Read-only projected entity status at a calendar day | Generic (derived-state display) | No — 0 consumers, test-only | `.entity-status-badge` | **Class does not exist in `style.css`** — unstyled `<span>` | None |
| `EntityPicker` (`src/ui/EntityPicker.tsx:20`) | Searchable combobox to pick an entity (keyboard nav, type/alias match) | Generic, reusable widget | Yes — used by `RelationsTab.tsx:152` | `.entity-picker`, `.entity-picker__input`, `.entity-picker__list`, `.entity-picker__item`, `.entity-picker__item.active`, `.entity-picker__item-title`, `.entity-picker__item-type`, `.entity-picker__item-summary` | Local (only consumer is `RelationsTab`) | None |
| `PropertiesForm` (`src/ui/PropertiesForm.tsx:203`) | Schema-driven property editor (string/bool/number/array/enum/mention-text fields) | Generic (schema-driven) | Yes — used by `EntityDetailView.tsx:233` | **None of its own** — raw `<label>`/`<input>`/`<select>` with no `className`; only styled because it is always rendered inside `.entity-detail__props-form` (style.css:810–832), a descendant-selector rule owned by the *caller* | Shared by context-coupling, not by design — see Finding B.4 | None |
| `MentionText` (`src/ui/PropertiesForm.tsx:39`) | Renders `@[Name](id)` mentions as clickable chips | Generic | Yes — used by `EntityDetailView.tsx:316` | `.mention-chip` | Local/shared (single definition, 1 consumer) | None |
| `MentionInput` (`src/ui/PropertiesForm.tsx:66`, internal) | Text input with `@`-mention autocomplete dropdown | Generic, but not exported — internal to `PropertiesForm` | Indirect (via `PropertiesForm`) | `.mention-suggest`, `.mention-suggest__item`, `.mention-suggest__item.active`, `.mention-suggest__type`, `.mention-suggest__name` | Local | None |
| `TagField` (`src/ui/PropertiesForm.tsx:162`, internal) | Chip-based multi-value text field (array properties) | Generic, internal to `PropertiesForm` | Indirect (via `PropertiesForm`) | `.tag-field__chips`, `.tag-field__chip` | Local | None |
| `DefaultFormGenerator` (`src/ui/DefaultFormGenerator.tsx:140`) + `FieldControl` (`:26`) | JSON-Schema → form generator (recursive, incl. nested objects) | Generic | No — 0 consumers, test-only | **None** — no `className` anywhere | N/A (unstyled) | None |
| `RelationsTab` (`src/ui/RelationsTab.tsx:37`) | Active/inactive relation list for an entity, add-relation flow via `EntityPicker` | View-specific (entity-detail tab) | Mounted once, via `registerEntityTab` in `tab-wiring.tsx:8` | `.relations-tab`, `.relations-tab__section`, `.relations-tab__row(--inactive)`, `.relations-tab__badge`, `.relations-tab__notes`, `.relations-tab__empty`, `.relations-tab__add`, `.relations-tab__add-form`, `.relations-tab__gm-toggle`, `.relations-tab__hint`, `.btn` | Local | None |
| `EntityTitle` (`src/ui/RelationsTab.tsx:27`, internal) | Resolves an entity id → title for display | View-specific helper | Indirect (via `RelationsTab`) | None (plain text node) | N/A | None |
| `BacklinksTab` (`src/ui/BacklinksTab.tsx:21`) | Reverse-mention lookup: entities that `@mention` this one | View-specific (entity-detail tab) | Mounted once, via `registerEntityTab` in `tab-wiring.tsx:15` | `.backlinks`, `.backlinks__item`, `.backlinks__title`, `.backlinks__type`, `.backlinks__empty` | Local | None |
| `CardList` (`src/ui/CardList.tsx:11`) | Type-filterable list of card instances (entity × template) | View-specific | No — 1 mount (`WorkspaceShell.tsx:730`) | **None** — bare `<select>`/`<div>`, no `className` | N/A (unstyled) | None |
| `CardPreview` (`src/ui/CardPreview.tsx:21`) | Visual mm-scaled preview of one card instance, overflow markers, export button | View-specific | No — 0 consumers (not even imported by `CardList`/`CardCreationFlow`), test-only | **None** — all layout via inline `style` object (line 41–47) | N/A (unstyled/inline) | `border: '1px solid #ccc'` (line 44); `backgroundColor: themeColor ?? '#fff'` (line 45) |
| `CardCreationFlow` (`src/ui/CardCreationFlow.tsx:12`) | 2-step wizard: pick entity → pick card template | View-specific | No — 1 mount (`WorkspaceShell.tsx:714`) | **None** — bare `<div>`/`<label>`, `style={{ cursor: 'pointer' }}` inline on rows (lines 48, 60) | N/A (unstyled) | None |
| `BodyEditor` (`src/ui/BodyEditor.tsx:73`) | TipTap rich-text editor for `body.blocks` (portable-blocks), custom entity-embed/secret-block/rule-reference nodes | Generic (block editor) | No — 0 consumers, test-only | **None** — toolbar `<button>`s and `<div role="toolbar">` unstyled | N/A (unstyled) | None |

## B. Duplication & similarity findings

### B.1 Button — 4 independent hand-rolled implementations, none using `<Button tone>`
- `.btn` / `.btn--primary` / `.btn--danger` (style.css:474–509, generic legacy button, pre-dates `primitives.tsx`) — used at `EntityMasterDetail.tsx:105` (`btn btn--primary`), `EntityDetailView.tsx:361,363,368,370,373` (`.btn`, `.btn.btn--primary`, both with inline `style={{ fontSize, padding }}` overrides), `EntitySessionNotes.tsx:64` (`.btn`), `RelationsTab.tsx:95,114,124` (`.btn`).
- `.emd__create-btn` / `.emd__create-confirm` / `.emd__create-cancel` (style.css:551, 586, 596) — 3 *more* bespoke button variants, defined solely for `EntityMasterDetail`'s inline create-form (`EntityMasterDetail.tsx:76,97,98`).
- `.entity-detail__edit-btn` (style.css:771) — a 4th bespoke icon-only button style, `EntityDetailView.tsx:378`.
- Canonical target: `<Button tone>` (`primitives.tsx:46-48`, `.ui-button`/`[data-tone='accent']`, `primitives.css:1-24`).
- Notable smell: `EntityDetailView.tsx:373` reinvents `.btn--danger` (style.css:501-505, already exists) via inline `style={{ color: 'var(--color-status-failure)' }}` instead of just adding the class.
- Difficulty: **needs-variant** — `Button` has no `danger` tone and no compact/icon-only size today; `.emd__create-*` trio needs a compact size variant too.

### B.2 Tabs — `.entity-detail__tab` vs `.ui-tabs__tab` (already flagged in shared reference §2/§3)
- Occurrence: `EntityDetailView.tsx:381-389` (render loop over static + `registerEntityTab`-injected tabs), CSS at style.css:705-724 (`.entity-detail__tabs`, `.entity-detail__tab`, `.entity-detail__tab.active`).
- Canonical: `<Tabs>` (`primitives.tsx:58-81`, `.ui-tabs`/`.ui-tabs__tab[aria-selected]`, `primitives.css:37-56`).
- Difficulty: **structural** — `EntityDetailView`'s tabs carry a per-tab `render()` function (`TabDefinition.render`, line 25), not just id/label; `<Tabs>` only handles selection UI (`activeId`/`options`/`onSelect`), so the content-per-tab dispatch would need to stay bespoke around a swapped-in `<Tabs>` shell.

### B.3 List row with hover/active state — 4 independent implementations inside this view alone
Part of the codebase-wide pattern already cataloged in the shared reference (§3, alongside `.gsearch__result`, `.map-token-list__row`, etc.). This view alone contributes:
- `.emd__item` / `.emd__item--active` (style.css:628-648, accent left-border + tinted bg via `color-mix`) — `EntityMasterDetail.tsx:114-120`.
- `.entity-picker__item` / `.active` (style.css:3473-3483, bg-only active state, no left-border) — `EntityPicker.tsx:70-76`.
- `.mention-suggest__item` / `.active` (style.css:1827-1841, bg-only) — `PropertiesForm.tsx:138-141`.
- `.relations-tab__row` (style.css:3391-3401, static surface-alt bg, no distinct hover/active state at all) — `RelationsTab.tsx:91,111`.
- `.backlinks__item` (style.css:2617-2636, border-based hover, no active state) — `BacklinksTab.tsx:53-58`.
- No `<ListRow>`/`<ListItem>` primitive exists yet — only `<ListSurface>` (a wrapper `<div>`, `primitives.css:128-132`) which doesn't define row/active semantics.
- Difficulty: **structural** — needs a new primitive designed first (row + hover + active-state contract), then 5 call sites migrated. Highest-leverage fix for this view since the pattern also recurs project-wide.

### B.4 Form input — `<Field>` duplicated, plus a fragile un-styled dependency
- `.entity-detail__input` / `.entity-detail__textarea` (style.css:795-808) — `EntityDetailView.tsx:201,206,353`.
- `.emd__create-input` (style.css:574-584) — `EntityMasterDetail.tsx:88`.
- `.entity-picker__input` (style.css:3451-3460) — `EntityPicker.tsx:59`.
- `.relations-tab__add-form select` (style.css:3428-3435) — `RelationsTab.tsx:127`.
- Canonical: `<Field label hint>` (`primitives.tsx:83-98`, `.ui-field__control`, `primitives.css:69-77`).
- **Separate, more urgent issue**: `PropertiesForm.tsx` (and its internal `TagField`/`MentionInput`) renders raw `<input>`/`<select>` with **no className of its own** (lines 216, 228, 240, 259-263, 188-189). It only *looks* styled today because `EntityDetailView.tsx:233` always wraps it in `<div className="entity-detail__props-form">`, and style.css:818-828 styles inputs via a descendant selector (`.entity-detail__props-form input[type="text"] …`) owned by the caller, not the component. If `PropertiesForm` is ever reused outside that one wrapper — e.g. a future generic property-editor host — its fields silently render unstyled. This is a correctness risk, not just a duplication.
- Difficulty: **needs-variant** for the straightforward `<Field>` swaps; **structural** for decoupling `PropertiesForm` from its caller's CSS.

### B.5 Pill/chip — 4 independent radius:999px chip implementations, none using `<StatusChip>`
- `.entity-detail__type-badge` (style.css:695-703) — `EntityDetailView.tsx:358`.
- `.relations-tab__badge` (style.css:3405-3412, "GM only" marker) — `RelationsTab.tsx:93`.
- `.mention-chip` (style.css:1801-1812) — `PropertiesForm.tsx:45`.
- `.tag-field__chip` (style.css:1852-1861) — `PropertiesForm.tsx:182`.
- Canonical: `<StatusChip tone>` (`primitives.tsx:100-106`, `.ui-status-chip[data-tone]`, `primitives.css:84-106`) — but `StatusChip` is tone-semantic (muted/success/warning/failure), while these four are label/type chips, not status chips.
- Difficulty: **needs-variant** — either add a neutral "label" tone to `StatusChip`, or these need a separate `<Chip>` primitive; not a drop-in.

### B.6 Panel/card shell — one instance
- `.relations-tab__add-form` (style.css:3417-3426: `border` + `border-radius: var(--radius-sm)` + `background: var(--color-surface-alt)`) — `RelationsTab.tsx:126` — conceptually the same "bordered inline panel" shape as `.ui-panel` (`primitives.css:26-31`), though `ui-panel` uses `radius-md` + `shadow-panel` + `surface` (not `surface-alt`).
- Difficulty: **needs-variant**.

## C. CSS hygiene

**Hardcoded colors:**
- `CardPreview.tsx:44` — `border: '1px solid #ccc'` → should be `var(--color-border)`.
- `CardPreview.tsx:45` — `backgroundColor: themeColor ?? '#fff'` → fallback should be `var(--color-surface)`.
- `style.css:493` — `.btn--primary { color: #fff; }`.
- `style.css:563` — `.emd__create-btn:hover { color: #fff; }`.
- `style.css:591` — `.emd__create-confirm { color: #fff; }`.
  (All three `#fff` instances are the "white-on-accent foreground" gap already noted as a known-missing token in the shared reference §1 — this view alone re-hardcodes it 3 times.)
- `style.css:502-503` — `.btn--danger { background: var(--color-status-failure, #c0392b); border-color: var(--color-status-failure, #c0392b); }` — the `#c0392b` fallback doesn't even match either theme's real `--color-status-failure` (`#9f3a2e` light / `#e06b6b` dark, `tokens.css:16,43`); dead fallback that can silently drift from the design.

**Dead / unused classes:**
- `.entity-detail__title` (style.css:740) — defined, never referenced by any component (the header uses `.entity-detail__name` instead, `EntityDetailView.tsx:356`).
- `.entity-session-notes`, `.entity-session-notes__toggle`, `.entity-session-notes__body` (used at `EntitySessionNotes.tsx:48,49,54`) — **no matching rule exists anywhere in `style.css`**; inverse-dead (component references classes CSS never defines).
- `.entity-status-badge` (used at `EntityStatusBadge.tsx:23`) — same: no matching rule in `style.css`.

**Misleading section comment:**
- style.css:852 `/* ── Cards fix ───────────────────────────────────────── */` — despite the name, this block (852-864) styles `.workspace-area__toolbar button` / `.workspace-area select`, i.e. generic workspace toolbar controls, not the Card components (`CardList`/`CardPreview`/`CardCreationFlow`). There is **no actual "Cards" CSS block** — grepping `.card` as a class prefix across `style.css` returns zero matches. All three Card components render unstyled/inline-styled.

**One-off classes (single use site):**
- `.relations-tab__hint` (style.css:3445) — used once, `RelationsTab.tsx:154`.
- `.tag-field__chip button` (style.css:1859-1862) — used once, `PropertiesForm.tsx:184`.
- `.emd__list-count`, `.emd__create-form`, `.emd__detail-empty` etc. — each used exactly once by construction (single consumer file); not flagged individually since `emd__*` is intentionally view-local, but worth noting the whole 17-class block exists to serve exactly one component.

**Magic numbers that should be tokens:**
- `border-radius: 999px` appears 4× for pill shapes (style.css:702, 1806, 1856, 3411) — shared reference §1 already lists "larger radii (999px/100px pills)" as a known-missing token; this view is 4 of the occurrences.
- `z-index: 500` (style.css:1823, `.mention-suggest`) — no z-index scale/token exists; arbitrary value with no documented relationship to other overlay z-indices in the file.
- Assorted fixed pixel widths with no token backing: `min-width: 100px` (`.entity-detail__prop-key`, style.css:766), `min-width: 220px` (`.mention-suggest`, style.css:1818), `min-width: 64px` (`.mention-suggest__type`, style.css:1847), `width: 260px` (`.emd__list`, style.css:526).

**`!important`:** none found in any of the CSS blocks covered by this view (checked style.css:517-904, 1795-1864, 2607-2653, 3376-3486; the 3 `!important` uses in the whole file are all outside these ranges).

## D. Top 3 consolidation opportunities for this view

1. **Button unification** (B.1). Replace `.btn`/`.btn--primary`/`.btn--danger`, the `.emd__create-*` trio, and `.entity-detail__edit-btn` — 7 distinct button rules across 4 files — with `<Button tone>`, extending it with a `danger` tone and a compact size variant first. Effort: **medium** (primitive extension + ~8 call-site swaps); removes the `EntityDetailView.tsx:373` inline-style anti-pattern as a side effect.
2. **List-row primitive** (B.3). Design a `<ListRow>`/`<ListItem>` primitive (row + hover + active-state contract) and migrate `.emd__item`, `.entity-picker__item`, `.mention-suggest__item`, `.relations-tab__row`, `.backlinks__item`. Effort: **large** (no primitive exists today, must be designed) but highest leverage — the same 5-way duplication pattern repeats across the whole app per the shared reference, so a design done here pays off everywhere.
3. **De-couple `PropertiesForm` from `.entity-detail__props-form`** (B.4). Give `PropertiesForm`/`TagField`/`MentionInput` their own classNames (or migrate to `<Field>`) instead of depending on a descendant selector owned by their one current caller. Effort: **medium**, but flagged as priority-3 for correctness rather than aesthetics — it is currently a landmine for the next feature that reuses `PropertiesForm` outside `EntityDetailView`.
