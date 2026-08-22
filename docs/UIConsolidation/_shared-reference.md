# UI Consolidation — Shared Reference (canonical vocabulary)

> Read this before analysing any view. Every view report must judge components **against
> this canonical layer**, not re-describe it. Goal of the whole effort: one clean component
> library + reusable CSS classes, all colors via tokens, so future implementers stop
> re-inventing CSS and we can later swap themes by editing variables only.

## 1. Design tokens — `src/styles/tokens.css` (THE only place colors may be defined)

Light `:root` + `[data-theme='dark']` override. Any hardcoded hex/rgba in a component is a
**defect to flag** unless there is no matching token.

**Colors:** `--color-text`, `--color-text-muted`, `--color-accent`, `--color-accent-strong`,
`--color-accent-soft`, `--color-surface`, `--color-surface-alt`, `--color-surface-hover`,
`--color-surface-active`, `--color-background`, `--color-border`,
`--color-status-success`, `--color-status-warning`, `--color-status-failure`, `--color-status-muted`.

**Spacing:** `--space-1` .25rem, `--space-2` .5rem, `--space-3` .75rem, `--space-4` 1rem.
**Radius:** `--radius-sm` 4px, `--radius-md` 6px. **Shadow:** `--shadow-panel`.

Known missing tokens (candidates to add later — flag when a component needs them):
overlay/scrim (`rgba(0,0,0,0.6)` recurring), `--space-5`, larger radii (`999px`/`100px` pills),
white-on-accent foreground (currently hardcoded `#fff`).

## 2. Design-system primitives — `src/ui/primitives.tsx` + `primitives.css`

These already exist but are **imported in only 2 files** (`LobbyPanel`, `WorkspaceShell`).
This is the intended reuse target. Components rolling their own equivalents = consolidation targets.

| Primitive | Class | Replaces the hand-rolled… |
|---|---|---|
| `<Button tone>` | `.ui-button` / `[data-tone='accent']` | `.btn`, `.emd__create-btn`, `.cal-add-btn`, per-view `<button>` styling |
| `<Panel>` | `.ui-panel` + `.ui-panel__body` | `.new-project__card`, `.cal-section`, `.token-editor` shells |
| `<Tabs>` | `.ui-tabs` / `.ui-tabs__tab[aria-selected]` | `.entity-detail__tab`, `.maps-sidebar-tabs__*`, nav tabs |
| `<Field label hint>` | `.ui-field` / `__label` / `__control` / `__hint` | `.cal-form__input`, `.entity-detail__input`, `.new-project__field` |
| `<StatusChip tone>` | `.ui-status-chip[data-tone]` | `.entity-detail__type-badge`, status pills |
| `<TableSurface>` | `.ui-table-surface` | ad-hoc `<table>` wrappers |
| `<ListSurface>` | `.ui-list-surface` | `.emd__items`, `.gsearch__results`, list wrappers |

## 3. Recurring hand-rolled patterns already spotted in `style.css` (to catalog everywhere)

- **Button**: `.btn` (+`--primary`/`--danger`), plus ~dozen bespoke button rules per view.
- **Tabs**: `.ui-tabs` vs `.entity-detail__tab` vs `.maps-sidebar-tabs` vs `.map-side-collapsed__tab`.
- **List row with active state**: `.emd__item`, `.gsearch__result`, `.map-token-list__row`,
  `.workspace-area__sidebar li button`, `.map-pin-tree__group-header` — all "row, hover bg,
  active = accent left-border or accent bg". Prime unification candidate.
- **Form input**: `.cal-form__input`, `.entity-detail__input`, `.new-project__field input`,
  `.token-editor input` — all "border, radius-sm, surface bg, accent focus". Near-identical.
- **Panel/card shell**: `.new-project__card`, `.cal-section`, `.token-editor`, `.mention-suggest`.
- **Pill/chip**: `.gsearch__facet`, `.tag-field__chip`, `.mention-chip`, `.map-token__counter`.
- **Tree sidebar**: `.map-pin-tree__*` (the gold-standard pin tree) vs `NestedTree.tsx` vs
  `MapFolderTree`. Pin tree is the reference; others should adapt to it.

## 4. Report format each view MUST follow (so reports merge cleanly)

Write to `docs/UIConsolidation/views/<view>.md` with these sections:

### A. Component inventory (one table row per component/subcomponent)
`| Component (file:line) | Role/purpose | Generic or view-specific? | Reused elsewhere? (where) | Key CSS classes | Local or shared classes? | Hardcoded colors (list hex/rgba) |`

### B. Duplication & similarity findings
For each hand-rolled pattern: name it, list every class + `file:line` occurrence, say which
canonical primitive (§2) or sibling it duplicates, and how hard replacing it is (drop-in / needs-variant / structural).

### C. CSS hygiene
Hardcoded colors (exact value + line), one-off classes used once, dead classes, `!important` uses,
magic numbers that should be tokens.

### D. Top 3 consolidation opportunities for this view (ranked, with effort estimate).

Keep it factual with `file:line` references. Do not propose the final library — that's the
consolidation step. Just catalog and map.
