# UI Consolidation — Index

Structured audit of Worlds and Beyond's UI to replace the "every implementer writes their own CSS in one
4,584-line file" reality with a real component library + tokenized CSS, and to enable the long-term goal:
fast, community-buildable themes. **This is analysis + mapping only — no source was edited.**

## The deliverable you asked for
➡️ **[component-library.md](component-library.md)** — the canonical component library: each primitive →
its role → canonical class → every duplicate class across all views with `file:line` → effort to unify.

## Read in this order
1. **[component-library.md](component-library.md)** — the consolidated map (start here).
2. **[_css-architecture-methodology.md](_css-architecture-methodology.md)** — state-of-the-art CSS structuring, applied to us (3-tier tokens, ITCSS-lite split, primitives-first rule).
3. **[_theming-community-themes.md](_theming-community-themes.md)** — how fast-switch + community-built themes actually work (Obsidian model) and what we need to get there.
4. **[_shared-reference.md](_shared-reference.md)** — the canonical vocabulary all audits used.
5. **[_style-css-block-map.md](_style-css-block-map.md)** — every `style.css` block → line → owning view.
6. **views/** — the six per-view audits: [entities](views/entities.md) · [search](views/search.md) · [maps](views/maps.md) · [calendar](views/calendar.md) · [audio](views/audio.md) · [graph](views/graph.md).

## The core finding
A real design system exists (`primitives.tsx`: Button, Panel, Tabs, Field, StatusChip, TableSurface,
ListSurface) and is **imported in 2 of ~70 components**. Every other view hand-rolls equivalents. Result:
**~20 button implementations, ~14 form-inputs, ~9 list-rows, 8 pills, 4+ tab strips** — the same widgets
re-invented per view. Tokens (`tokens.css`) are clean but bypassed by ~15+ hardcoded `#fff` and scattered
`rgba()` values. `NestedTree` (the pin tree) is the **one** already-consolidated pattern — the model to copy.

## Top consolidation moves (ranked, cross-view)
1. **Add the missing tokens** (`--color-on-accent`, `--color-scrim`, `--radius-pill`, adopt `--shadow-panel`).
   Lowest risk, kills ~20 hardcoded colors, and is the foundation for theming. *(drop-in)*
2. **Unify Button** — ~20 implementations → `<Button>` + `danger`/`icon`/`circle`/`glass` variants. *(needs-variant)*
3. **Design the `<ListRow>` primitive** — the biggest gap (no primitive exists; pattern recurs everywhere). *(structural)*
4. **Converge form inputs on `<Field>`** — after giving it a control/`children` slot + resolving the
   `--color-background`-vs-`--color-surface` divergence; **and decouple `PropertiesForm` from its caller's CSS**. *(needs-variant)*
5. **Tabs, pills, panels** onto their primitives with the variants listed in the library map. *(mixed)*

## Sequencing toward themes
audits ✅ → **component-library.md ✅** → restructure `styles/` (ITCSS-lite) + add primitive palette layer +
missing tokens + `@layer` → publish `variables.md` contract → **themes = one-file palette overrides the
community can author.** Details in the two research docs.

---

## Annex: non-cosmetic defects surfaced by the audits
Not CSS-consolidation, but real issues the audits turned up — worth their own tickets (review findings).

**Likely bugs**
- **Event `start_day` has no edit affordance** in view *or* edit mode — view mode is read-only text, edit
  mode renders it as a plain non-interactive span while only `end_day` gets a `CalendarDateInput`
  (calendar audit B.6: `EntityDetailView.tsx:262-273`, `EventFormFields.tsx:209-221`). Matches your earlier
  "calendar date field empty in entity browser" complaint.
- **`PropertiesForm` renders unstyled if reused** outside `EntityDetailView` — it has no CSS of its own and
  depends on a descendant selector owned by its one caller (entities B.4). Correctness landmine for the next reuse.

**Duplicate CSS definitions (same selector, diverging rules, far apart)**
- `.map-pin__label` — style.css:1273 **and** 2127 (second wins; first is dead, misleads readers).
- `.map-folder-tree__confirm-dialog` — style.css:1939 **and** 3738.
- `.audio-soundboard-window` — style.css:191 **and** 3818.

**Dead CSS (zero JSX references)**
- ~50 lines of `MapFolderTree` pre-refactor rules (`.map-folder-tree__folder-row/__map-row/__root/…`, style.css:3768-3812).
- `.gv-segbar` / `.gv-segbar__btn` (graph.css:22-27).
- `.cal-form__row--info` / `__value` / `__columns` / `.cal-link__date` (calendar).
- `.entity-detail__title` (entities).
- `.gsearch__bar` — dead positioning hook (search).

**Inverse-dead (component uses a class that CSS never defines → silently unstyled)**
- `.entity-session-notes*`, `.entity-status-badge` (entities) · `.map-context-menu__item--off`,
  `.fog-tools__stamp-levels`, `.layer-panel__delete-confirm`, `.pin-entity-add__select` (maps).

**Duplicated logic (not CSS)**
- Spotify/YouTube player twins ~70% identical (audio B1) — candidate for a shared `useHiddenIframeEmbed` hook.
- Date-triplet built 3 ways, 2 of them unclamped (calendar B.4).
- `DEFAULT_CLIP_COLOR` hex duplicated across `ClipButton.tsx:9` + `ClipEditor.tsx:16` (audio B5).

**Orphaned components (0 mounts, test-only)** — per the p-level convention these are *expected-unbuilt*
stories, **not** dead-wiring bugs; listed so they aren't mistaken for either: `EntityTable`,
`EntityReadingView`, `EntitySessionNotes`, `EntityStatusBadge`, `DefaultFormGenerator`, `CardPreview`,
`BodyEditor`, `CaptureInbox`.

**Misleading comment:** `style.css:852 /* Cards fix */` styles workspace toolbar buttons, not Cards — there
is no Cards CSS at all; all three Card components render unstyled/inline.
