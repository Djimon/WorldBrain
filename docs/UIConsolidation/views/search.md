# Search view — UI Consolidation audit

Scope: `GlobalSearch.tsx`, `CaptureInbox.tsx`, plus `EntityPicker.tsx` / `EmojiPicker.tsx` used
only as comparators for the "search box" idiom. CSS: `src/style.css` `.gsearch*` block
(lines 866–981), plus the comparator blocks `.entity-picker*` (3447–3486) and `.emoji-picker*`
(4490–4579).

## A. Component inventory

| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors |
|---|---|---|---|---|---|---|
| `GlobalSearch` (`src/ui/GlobalSearch.tsx:12`) | Global entity search: search box + type facets + keyboard-navigable result list, mounted as the "search" workspace tab | View-specific | No — only mount site is `WorkspaceShell.tsx:420` (`case 'search'`) | `.gsearch`, `.gsearch__bar`, `.gsearch__input`, `.gsearch__facets`, `.gsearch__facet`, `.gsearch__facet--active`, `.gsearch__facet-count`, `.gsearch__hint`, `.gsearch__empty`, `.gsearch__results`, `.gsearch__result`, `.gsearch__result--selected`, `.gsearch__result-title`, `.gsearch__result-type`, `.gsearch__result-summary` | Local — entire block only referenced from this component | `#fff` at `style.css:918` (`.gsearch__facet--active { color: #fff; }`) |
| `CaptureInbox` (`src/ui/CaptureInbox.tsx:29`) | Session quick-capture inbox: capture-type select, text input, "link entity" search box, status filter, capture list | View-specific | No — the only reference to `CaptureInbox` in `src/**` is its own definition; no `import { CaptureInbox }` exists anywhere in `src/ui` (incl. `WorkspaceShell.tsx`). Only consumer is `tests/m4-s07-capture-inbox.dom.test.tsx` | **None.** Every element is an unstyled `<div>/<select>/<input>/<ul>/<li>` — zero `className` attributes anywhere in the file (only `data-type`/`data-status` test hooks) | N/A — no CSS exists for this component in `style.css` at all | N/A — no colors, no styling of any kind |
| `EntityPicker` (`src/ui/EntityPicker.tsx:20`) — comparator only | Generic entity search-and-select combobox (typeahead + arrow-key nav) | Generic | Yes — imported by `MapViewer.tsx` and `RelationsTab.tsx` (grep confirmed) | `.entity-picker`, `.entity-picker__input`, `.entity-picker__list`, `.entity-picker__item`, `.entity-picker__item-title` (no dedicated rule — inherits), `.entity-picker__item-type`, `.entity-picker__item-summary` | Local block (`style.css:3447–3486`), consumed by 3 components | None — all `var(--color-*)` |
| `EmojiPicker` (`src/ui/EmojiPicker.tsx:56`) — comparator only | Generic emoji picker: search box + category tabs + grid | Generic | Yes — `AudioSoundboardWindow.tsx`, `EmojiPickerHost.tsx`, `SoundboardBoard.tsx`, `ClipEditor.tsx` (grep confirmed) | `.emoji-picker`, `.emoji-picker__search`, `.emoji-picker__tabs`, `.emoji-picker__tab`, `.emoji-picker__tab-icon`, `.emoji-picker__groups`, `.emoji-picker__group-label`, `.emoji-picker__grid`, `.emoji-picker__emoji` | Local block (`style.css:4490–4579`), consumed by 4 components | None — all `var(--color-*)` |

Note on `CaptureInbox`: per project convention (not-yet-built story = mocks/tests only, zero
mounts expected), this is not "dead wiring" — it simply hasn't reached its UI-styling pass yet.
Flagged here purely as a CSS-hygiene data point: **when it is built, it should adopt the
primitives below directly rather than hand-roll a fourth version of the search-input/list-row
idiom.**

## B. Duplication & similarity findings

### B1. Search / filter input
The one idiom asked to go deep on. Four independent implementations of "text input, border,
radius, surface bg, accent-ish focus":

| Class | file:line | padding | radius | bg | focus treatment |
|---|---|---|---|---|---|
| `.gsearch__input` | `style.css:881–897` | `var(--space-3) var(--space-4)` (token) | `var(--radius-md)` | `var(--color-surface)` | `border-color: var(--color-accent)` + `box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-accent) 25%, transparent)` (ring) |
| `.entity-picker__input` | `style.css:3451–3460` | `6px 8px` (hardcoded px, no token) | `var(--radius-sm)` | `var(--color-surface)` | `border-color: var(--color-accent)` only, no ring |
| `.emoji-picker__search` | `style.css:4500–4509` | `4px 8px` (hardcoded px) | `var(--radius-sm)` | `var(--color-surface-alt)` (different surface tier) | **none defined** — falls back to UA default |
| `.ui-field__control` (canonical primitive) | `primitives.css:69–77` | `var(--space-2) var(--space-3)` (token) | `var(--radius-sm)` | `var(--color-surface)` | none defined in primitive either |

None of the three view components import `Field`/`.ui-field__control`. All three re-derive the
same "bordered box, radius, surface, accent border on focus" rule with a different padding scale
(one token-based, two hardcoded px), a different radius tier, and three different (mutually
inconsistent) focus treatments — one has a focus ring, one has a border-only focus, one has no
focus style at all. **Unifiable, but needs-variant**: `Field`/`.ui-field__control` would need a
`type="search"` affordance and a decision on the focus-ring treatment before the three call
sites can converge on it.

### B2. Facet / filter pill
| Class | file:line | radius | active/accent state |
|---|---|---|---|
| `.gsearch__facet` / `--active` | `style.css:905–923` | `100px` (hardcoded) | active: `background: var(--color-accent)`, `color: #fff` (hardcoded) |
| `.tag-field__chip` | `style.css:1853–1862` | `999px` (hardcoded — different magic number, same visual pill) | n/a (not a toggle; static tag chip on `var(--color-surface-active)`) |
| `.map-token__counter` | `style.css:1378–1387` | `10px` (hardcoded — third distinct pill-radius value) | always-on: `background: var(--color-accent-strong, #c0392b)` (hardcoded hex fallback), `color: #fff` (hardcoded), plus `box-shadow: 0 1px 3px rgba(0,0,0,0.6)` (hardcoded rgba, unrelated to `--shadow-panel`) |

Three pill/badge implementations, three different hardcoded radius constants for the same
"fully-rounded pill" intent (confirms the shared-reference's flagged gap: no `999px`/`100px`
pill-radius token exists yet). `.gsearch__facet--active` and `.map-token__counter` both hardcode
`color: #fff` for white-on-accent text — this is exactly the "white-on-accent foreground
currently hardcoded `#fff`" gap called out in `tokens.css` §1 of the shared reference, occurring
twice in this view's neighborhood alone. Canonical primitive `StatusChip` (`.ui-status-chip`,
`primitives.css:84–106`) covers the static/read-only pill case but has no clickable/toggle
variant, so `.gsearch__facet` can't drop in as-is. **needs-variant.**

### B3. Result row with active/selected state
| Class | file:line | layout | idle border | hover | active/selected |
|---|---|---|---|---|---|
| `.gsearch__result` / `--selected` | `style.css:941–956` | CSS grid (`1fr auto` / 2 rows) | `border-left: 2px solid transparent` | `background: var(--color-surface-alt)` | `border-left-color: var(--color-accent)` (same bg as hover) |
| `.emd__item` / `--active` | `style.css:628–648` | flex column | `border-left: 2px solid transparent` | `background: var(--color-surface-alt)` | `background: color-mix(in srgb, var(--color-accent) 15%, transparent)` + `border-left-color: var(--color-accent)` |
| `.entity-picker__item` / `.active` | `style.css:3473–3483` | flex row, `align-items: baseline` | none (no left border) | `background: var(--color-surface-active)` | same as hover — flat `var(--color-surface-active)`, no left border |
| `.map-token-list__row .active .map-token-list__name` | `style.css:1709–1742` | flex row | none | n/a | `background: var(--color-accent)` (solid fill, not tint) + `color: #fff` (hardcoded) |

Same conceptual idiom, four different visual treatments. `.gsearch__result` and `.emd__item` are
the closest pair — both use the left-border-accent + `surface-alt` hover mechanism named in the
shared reference as the "prime unification candidate" — they differ only in grid-vs-flex layout
and in whether the active state also tints the background (`emd__item` does via `color-mix`,
`gsearch__result` doesn't, reusing the hover bg instead). **drop-in-adjacent** for this pair; a
shared `.ui-list-surface` row class (§2 canonical target) could absorb both with a layout
modifier. `.entity-picker__item` (flat active bg, no left border) and `.map-token-list__row`
(solid accent fill, hardcoded `#fff` text) are further from the other two — **structural** effort
to fully converge all four onto one idiom.

## C. CSS hygiene

- **Hardcoded colors:**
  - `style.css:918` — `.gsearch__facet--active { color: #fff; }`
  - `style.css:1384` — `.map-token__counter { background: var(--color-accent-strong, #c0392b); }` (hardcoded hex *fallback* value baked into the `var()`)
  - `style.css:1385` — `.map-token__counter { color: #fff; }`
  - `style.css:1386` — `.map-token__counter { box-shadow: 0 1px 3px rgba(0,0,0,0.6); }`
  - `style.css:1742` — `.map-token-list__row.active .map-token-list__name { color: #fff; }`
  - (in-scope comparator blocks `.entity-picker*` and `.emoji-picker*` have **no** hardcoded colors — both are fully token-driven)
- **`!important` uses:** none found in `.gsearch*`, `.entity-picker*`, `.emoji-picker*`,
  `.tag-field__chip`, `.map-token__counter`, or `.map-token-list__row` blocks. (Only 3 uses exist
  file-wide, at `style.css:1134,3274,3275` — unrelated to this view.)
- **One-off / thin wrapper class:** `.gsearch__bar` (`style.css:877–879`) has a single
  declaration (`position: relative`) and exists only to give `.gsearch__input` a positioning
  context that nothing currently uses (no absolutely-positioned child exists in `GlobalSearch.tsx`
  today) — dead positioning hook, candidate for removal or fold into `.gsearch__input`'s parent.
- **Magic numbers that should be tokens:**
  - `style.css:906` `.gsearch__facet { padding: 2px var(--space-2); }` — the `2px` doesn't match
    any `--space-*` step (smallest is `--space-1` = 4px).
  - `style.css:908` `.gsearch__facet { border-radius: 100px; }`, `style.css:1856`
    `.tag-field__chip { border-radius: 999px; }`, `style.css:1383` `.map-token__counter {
    border-radius: 10px; }` — three different magic numbers for "pill radius", confirming the
    shared-reference's noted missing `--radius-pill` token.
  - `style.css:945` / `style.css:938` — `.gsearch__result`/`.gsearch__results` both use a raw
    `2px` row/column gap instead of a `--space-*` token.
  - `style.css:3456` `.entity-picker__input { padding: 6px 8px; }` and `style.css:4506`
    `.emoji-picker__search { padding: 4px 8px; }` — raw px paddings where `.gsearch__input`
    already uses token-based padding; three sibling inputs, three different padding scales.
- **`CaptureInbox.tsx`:** not a "hygiene defect" in the hardcoded-color sense — it has zero CSS
  to audit. Flagged here so it isn't silently skipped: when styled, it must not become a 5th
  from-scratch version of B1–B3's idioms (it already needs a search box for "Link entity" at
  `CaptureInbox.tsx:90–95`, which is the exact B1 pattern, and a result list at
  `CaptureInbox.tsx:113–122`, which is the exact B3 pattern).

## D. Top 3 consolidation opportunities for this view

1. **Search-input unification (`.gsearch__input`, `.entity-picker__input`,
   `.emoji-picker__search`, and `.ui-field__control`)** — highest impact: 3 existing hand-rolled
   inputs plus the canonical primitive already partially overlapping, and `CaptureInbox`'s
   unbuilt "Link entity" field (`CaptureInbox.tsx:90–95`) would be a 4th if not caught now.
   Effort: **needs-variant** — add a `type="search"` mode and settle one focus treatment (ring
   vs border-only) on `Field`/`.ui-field__control`, then migrate the 3 call sites.
2. **Result-row active-state unification, starting with `.gsearch__result` + `.emd__item`** —
   these two are near-identical (left-border-accent + `surface-alt` hover) and are explicitly
   named in the shared reference as the prime unification candidate; `.entity-picker__item` and
   `.map-token-list__row` are real but farther-out follow-ups. Effort: **drop-in** for the
   gsearch/emd pair onto a shared `.ui-list-surface` row class; **structural** to bring in the
   other two siblings.
3. **Pill/badge primitive with a `--radius-pill` token, replacing `.gsearch__facet`,
   `.tag-field__chip`, `.map-token__counter`** — resolves 3 duplicated pill-radius magic numbers
   and 2 duplicated hardcoded `#fff` white-on-accent values in one move. Effort:
   **needs-variant** — extend `StatusChip`/`.ui-status-chip` with a clickable/toggle tone and add
   the missing pill-radius + white-on-accent tokens called out in `tokens.css` §1.
