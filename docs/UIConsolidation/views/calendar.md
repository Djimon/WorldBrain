# Calendar view — UI Consolidation audit

Scope: `CalendarMonthView.tsx`, `CalendarWizard.tsx`, `CalendarDateInput.tsx`,
`CalendarLinkPanel.tsx`, `ChronicleView.tsx`, `EventFormFields.tsx` (all in `src/ui/`), and
the "Calendar Form" CSS block in `src/style.css` (`.cal-*`, `.event-form-fields*`, roughly
lines 985–1174 and 2655–3374). Read against `docs/UIConsolidation/_shared-reference.md`,
`src/styles/tokens.css`, `src/ui/primitives.tsx`/`primitives.css`.

All six components are mounted from `src/ui/WorkspaceShell.tsx` (`CalendarWizard.tsx:537`,
`CalendarMonthView.tsx:576`, `CalendarLinkPanel.tsx:662`, `ChronicleView.tsx:698`) plus
`EventFormFields.tsx` mounted from `src/ui/EntityDetailView.tsx:212`. None of the six are
imported by more than one call site — this view has zero cross-reuse of its own
view-specific components (only the shared `CalendarDateInput` sub-widget is reused, see below).

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `CalendarMonthView` (`src/ui/CalendarMonthView.tsx:41-222`) | Month grid: day cells, event chips, year-popout nav, era-mode toggle | View-specific (era/day-counter domain logic) | No — only `WorkspaceShell.tsx:576` | `cal-month`, `cal-month__bar`, `cal-month__nav`, `cal-year-nav`, `cal-year-popout(+__pills/__adjacent/__pill/__adj-pill/__active/__goto)`, `cal-month__select`, `cal-month__spacer`, `cal-month__name`, `cal-form__input` (149), `cal-form__select` (173), `cal-grid(+__row/__dow/__day/__day-num/__event)`, `cal-yearmode(+__btn)` | Mostly local; `cal-form__input`/`cal-form__select` shared with Wizard/LinkPanel | None in TSX (see CSS list below) |
| `CalendarWizard` (`src/ui/CalendarWizard.tsx:43-320`) | Multi-tab (months/weekdays/eras) calendar create/edit form | View-specific | No — only `WorkspaceShell.tsx:537` (both create + edit) | `cal-form(+__header/__title/__summary+__item+__sep/__body)`, `btn`/`btn--primary`, `cal-section(+__head/__title)`, `cal-form__row`, `cal-form__label`, `cal-form__input`, `cal-form__select`, `cal-datefield(+__unit/__label)`, `cal-year-input`, `cal-month-days`, `cal-tabs`, `cal-tab`, `cal-add-btn`, `cal-month-grid/-row/-num/-name/-days-label`, `cal-remove-btn`, `cal-week-grid/-row`, `cal-era-grid/-row(+__top/__dates)`, `cal-era-label/-name/-abbr`, `cal-hint` | Local `cal-form`/`cal-section`/`cal-tabs` family, shared with sibling calendar components | None (2 inline `style={{ color: 'var(--color-text-muted)' }}` uses at lines 204, 225 — token-only, no hex, but bypass the existing `.cal-hint` class) |
| `CalendarDateInput` (`src/ui/CalendarDateInput.tsx:25-96`) | Reusable clamped day/month/year triplet, driven purely by a `months` prop | **Generic** — no calendar-view-specific logic, just a controlled date-triplet widget | Yes — `CalendarWizard.tsx:8,296,299` (era start/end), `EventFormFields.tsx:21,216` (event end date), `EffectEditor.tsx:19,93` (out of scope but confirms 3rd consumer) | `cal-dateinput`, `cal-dateinput__unit`, `cal-dateinput__label`, `cal-dateinput__day/__month/__year`, `cal-dateinput--snap` | Local, and **not** reused by two other places that need the identical widget (see B.4) | None |
| `CalendarLinkPanel` (`src/ui/CalendarLinkPanel.tsx:33-111`) | Collapsible panel to calibrate/link two calendars via one stated date equivalence | View-specific | No — only `WorkspaceShell.tsx:662` | `cal-section` (shared shell), `cal-link`, `cal-link__toggle`, `cal-link__row`, `cal-link__cal`, `cal-link__eq`, `cal-link__preview`, `cal-link__status`, `cal-form__select` (72), `cal-datefield(+__unit/__label)` via local `LabeledDate` helper (91-111), `btn`/`btn--primary` | Local `cal-link__*`; `cal-datefield` is a duplicate of the pattern `CalendarDateInput` already solves (see B.4) | None |
| `ChronicleView` (`src/ui/ChronicleView.tsx:18-47`) | Flat list of all Events, sortable asc/desc by `start_day` | View-specific | No — only `WorkspaceShell.tsx:698` | **None** — every `div`/`span`/`button`/`ul`/`li` is unstyled, zero `className` anywhere in the file | N/A — completely unstyled, not even using local `cal-*` classes | None (no styling present at all) |
| `EventFormFields` (`src/ui/EventFormFields.tsx:152-271`) + nested `RelationAutocomplete` (70-150) | Event-specific edit fields (end date, participant/location relation autocomplete, visibility, category), mounted inside the generic Entity edit form | View-adjacent (calendar-domain, but consumed by the generic Entity form, not the calendar view) | Mounted once (`EntityDetailView.tsx:212`); `CalendarDateInput` sub-widget reused inside it (line 216) | `event-form-fields`, `event-form-fields__kind`, `event-form-fields__field-label`, `event-form-fields__enddate`, `event-form-fields__pills`, `event-form-fields__autocomplete`, `event-form-fields__suggest(+__suggest-item)`, plus bare `.event-form-fields > input/select` element selectors (no class name at all) | Local; the bare-element input styling (style.css:3157-3172) is a 4th copy of the "form input" recipe (see B.1/B.5) | None |

## B. Duplication & similarity findings

**B.1 — Form input restyled three (really four) times.**
`.cal-form__input`/`.cal-form__select` (style.css:1075-1100; used `CalendarWizard.tsx` throughout, `CalendarMonthView.tsx:148,173`, `CalendarLinkPanel.tsx:72`) vs `.entity-detail__input` (style.css:795-800, `EntityDetailView.tsx`) vs the canonical `.ui-field__control` (primitives.css:69-77). All three share the identical recipe — 1px `var(--color-border)`, `var(--radius-sm)`, `var(--color-text)`, ~0.875–0.9rem font, focus → `border-color: var(--color-accent)` — **except** `.cal-form__input`'s background is `var(--color-background)` while `.entity-detail__input` and `.ui-field__control` both use `var(--color-surface)`. A real value divergence hiding behind near-identical markup.
A fourth near-copy exists as bare element selectors, not even a class: `.event-form-fields > input[type="text"], input[type="number"], select` (style.css:3157-3172) — same recipe again.
Effort: **needs-variant** (must resolve the background-token discrepancy first, plus decide how to migrate an un-classed selector-based style into a component).

**B.2 — Section/panel shell.**
`.cal-section` (style.css:1027-1035; `CalendarWizard.tsx` multiple, `CalendarLinkPanel.tsx:62`) vs `.ui-panel`/`.ui-panel__body` (primitives.css:26-35). Same recipe (1px border, `var(--radius-md)`, `var(--color-surface)` background); `.ui-panel` additionally adds `box-shadow: var(--shadow-panel)` which `.cal-section` lacks. Effort: **drop-in**.

**B.3 — Add/remove button pair.**
`.cal-add-btn`/`.cal-remove-btn` (style.css:1144-1174; 3× add + 3× remove in `CalendarWizard.tsx`) vs `.ui-button[data-tone]` (primitives.css:1-24). `cal-add-btn` is a bespoke outline-accent button with no `data-tone` equivalent and hardcodes `color: #fff` on hover (1156, 1173) instead of a token — this is exactly the "white-on-accent foreground" gap already called out as a known-missing token in `_shared-reference.md` §1. Effort: **needs-variant** (`Button` has no small/icon-only variant yet for the ✕ remove button).

**B.4 — Date-triplet duplicated three ways (largest structural finding).**
- `CalendarDateInput.tsx` is the real, tested, **clamped** y/m/d widget (`cal-dateinput*` classes, style.css:3094-3129) — clamps day to the selected month's length and shows a "snap" cue when clamping fires.
- `CalendarWizard.tsx`'s own "Startdatum" row (lines 206-226) hand-rolls an **unclamped** y/m/d triplet using `cal-datefield`/`cal-datefield__unit`/`cal-form__input cal-month-days`/`cal-year-input` (style.css:2962-2987) — in the *same file* that correctly imports and uses `CalendarDateInput` for era start/end two tabs later (lines 296-300).
- `CalendarLinkPanel.tsx`'s local `LabeledDate` helper (lines 91-111) hand-rolls the identical `cal-datefield` triplet a third time, again unclamped, again not using `CalendarDateInput` even though it's a one-line import away.
Effort: **structural** but well-isolated (2 files); removes ~35 duplicate lines and lets the parallel `cal-datefield` CSS block (2962-2987) be retired in favor of `cal-dateinput*`. Also fixes a latent correctness gap — two of three places allow an out-of-range day/month where the third clamps it.

**B.5 — Tabs.**
`CalendarWizard.tsx`'s `.cal-tabs`/`.cal-tab` (style.css:2934-2960, markup at lines 230-234) is a fourth home-rolled tab strip alongside the ones already cataloged in `_shared-reference.md` §3 (`.entity-detail__tab`, `.maps-sidebar-tabs`, `.map-side-collapsed__tab`) — not using `<Tabs>`/`.ui-tabs` (primitives.tsx:58-81) despite an exact shape match: `role="tablist"`/`role="tab"`, `aria-selected`, bottom-border-accent active state. The component's own `activeId`/`options`/`onSelect`/`label` API maps directly onto the `tab`/`setTab` state already present. Effort: **drop-in**.

**B.6 — Display-mode vs edit-mode divergence for Event dates (per the task's specific ask).**
`EntityDetailView.tsx` renders Event dates two structurally different ways depending on mode:
- **View mode** (`EntityDetailView.tsx:262-273`): `start_day`/`end_day` are read-only text via `formatCalendarDate(...)`, wrapped in plain `.entity-detail__prop-row`/`.entity-detail__prop-val` spans — no calendar widget at all.
- **Edit mode** (`EntityDetailView.tsx:209-224` → `EventFormFields.tsx`): mounts `EventFormFields`, which renders `end_day` as a full `CalendarDateInput` widget (`EventFormFields.tsx:213-221`) but renders `start_day` as a **plain, non-interactive text span** (`event-form-fields__kind`, `EventFormFields.tsx:209-211`, `Start: {formatCalendarDate(...)}`) — i.e. even in "edit mode" the start date is not actually editable through any input element, only the end date is. This is the exact shape of bug class the task flagged (edit-mode fields differing from view-mode fields): the start date has no edit affordance in either mode, and the end-date editor uses a completely different component/markup family (`CalendarDateInput`) than the read-only overview uses (`formatCalendarDate` in a plain span). Any future fix for "start date not editable" will need to reconcile these two rendering paths rather than extend either one in isolation.

## C. CSS hygiene

**Hardcoded colors** (all five are the same "white-on-accent" gap, `_shared-reference.md` §1):
- style.css:1156 — `.cal-add-btn:hover { color: #fff; }`
- style.css:1173 — `.cal-remove-btn:hover { color: #fff; }`
- style.css:2749 — `.cal-year-popout__active { color: #fff; }`
- style.css:2855 — `.cal-grid__event { color: #fff; }`
- style.css:3062 — `.cal-yearmode__btn.active { color: #fff; }`
- style.css:2705 — `.cal-year-popout { box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45); }` — hardcoded shadow instead of `var(--shadow-panel)` (which is `0 12px 28px rgba(15,18,22,.12)` light / `0 12px 28px rgba(0,0,0,.45)` dark — different spread/blur, so not even value-consistent with the token it should probably be).

**Dead classes** (defined in style.css, zero references anywhere in `src/**/*.tsx`):
- `.cal-form__row--info` (style.css:1058)
- `.cal-form__value` (style.css:1070)
- `.cal-form__columns` (style.css:1020)
- `.cal-link__date` / `.cal-link__date input` (style.css:2904, 2909) — `CalendarLinkPanel`'s `LabeledDate` helper uses `cal-datefield` instead, so this class was superseded but never removed.

**`!important`:**
- style.css:1134 — `.cal-month-days { flex: none !important; }` — forces an override against the `flex: 1` declared by whichever sibling class (`cal-month-name`/`cal-era-name`) is combined with it on the same input, rather than resolving the specificity conflict structurally.

**Magic numbers that should be tokens:**
- Radii hardcoded as `6px` (≈ `var(--radius-md)`) instead of the token: style.css:2676 (`.cal-month__nav`), 2836 (`.cal-grid__day`), 2872 (`.cal-form__summary`), 3007 (`.cal-era-row`), 3043 (`.cal-yearmode`).
- Radius hardcoded as `4px` (≈ `var(--radius-sm)`): style.css:2853 (`.cal-grid__event`).
- Spacing scale (`--space-1..4` = .25/.5/.75/1rem) not applied consistently even within this one block — raw px used alongside `var(--space-*)` for what looks like the same visual gap: `.cal-month__bar` gap `6px`/margin-bottom `14px` (2662-2663), `.cal-year-popout` padding `12px`/gap `10px` (2699-2701), `.cal-grid` gap `4px` (2809), `.cal-form__summary` padding `8px 12px`/gap `8px` (2867-2868), `.cal-tabs` gap `4px`/margin `8px 0 12px` (2936, 2938), `.cal-era-row` padding `8px 10px`/gap `6px` (3004-3005).
- `.cal-inline-event-editor` (mounted from `WorkspaceShell.tsx`, not the 6 in-scope components, but part of the same CSS block): `width: 50%; min-width: 420px;` (style.css:3346-3347) — magic layout numbers with no token equivalent.
- `CalendarWizard.tsx:204,225` use inline `style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}` instead of the `.cal-hint` class the same file already uses elsewhere (line 312) for equivalent muted helper text.

## D. Top 3 consolidation opportunities (ranked)

1. **Collapse the three y/m/d triplet implementations onto `CalendarDateInput`** (B.4) — replace `CalendarWizard.tsx:206-226` and `CalendarLinkPanel.tsx:91-111`'s hand-rolled `cal-datefield` markup with `<CalendarDateInput>`; retire the parallel `cal-datefield*` CSS (style.css:2962-2987). Removes ~35 duplicated lines, one CSS block, and a latent unclamped-date correctness gap. Effort: **structural, small** (2 files).

2. **Swap `CalendarWizard`'s `.cal-tabs`/`.cal-tab` for the `<Tabs>` primitive** (B.5) — API already matches 1:1 (`activeId`/`options`/`onSelect`/`label`), no new variant needed. Effort: **drop-in**.

3. **Unify `.cal-form__input`/`.cal-form__select`/`.entity-detail__input`/the un-classed `.event-form-fields` inputs onto `.ui-field__control`** (B.1) — four near-identical input recipes across calendar + entity views. Requires first deciding the background-token question (`--color-background` vs `--color-surface`) and giving the `event-form-fields` inputs an actual class to migrate off of. Effort: **needs-variant**.

*Honorable mention:* `ChronicleView.tsx` uses zero CSS classes at all — nothing to "consolidate" since there's no legacy styling to migrate away from, but it's the cleanest candidate to adopt `<ListSurface>`/`.ui-list-surface` directly (primitives.tsx:116-122) with no retrofit cost.
