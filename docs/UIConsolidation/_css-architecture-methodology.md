# CSS Architecture — State of the Art, applied to Worlds and Beyond

> Research companion to the view audits. Written for OUR situation: one 4,584-line `style.css`,
> an orphaned `primitives.tsx` design system, colors half-tokenized. This defines the target
> architecture the consolidation should move toward, and it directly serves the stated
> long-term goal: *"einfache Color-Variable-Definitionen, die direkt das ganze Bild ändern"* (themes).

## 1. The one idea that unlocks theming: a THREE-tier token model

Modern design-system practice (W3C DTCG 2025.10, Style Dictionary, every serious system) layers tokens:

```
① PRIMITIVE  (raw palette)     --red-700: #7b1d1d;  --gray-100: #f7f8fa;  --space-2: .5rem;
                                    ↓ referenced by
② SEMANTIC   (role/intent)     --color-accent: var(--red-700);  --color-surface-alt: var(--gray-100);
                                    ↓ referenced by
③ COMPONENT  (optional)        --button-bg: var(--color-accent);   (only when a component needs a contract)
```

**Components reference ONLY semantic tokens, never primitives, never hex.** That discipline is the
entire payoff: a theme is then just re-pointing the semantic layer (or swapping the primitive
palette) — components never change.

### Where Worlds and Beyond is today
`tokens.css` already has a **semantic** layer (`--color-accent`, `--color-surface`…) and does dark
mode the right way (`[data-theme='dark']` redefines the semantic values). That's good and should stay.
**What's missing is the primitive layer below it.** Right now dark mode hand-writes 15 new hex values.
To hit the "one variable changes the whole picture" goal, introduce a primitive palette so a theme =
a small set of primitive definitions the semantic layer points at. This is the single highest-leverage
structural change and it's non-breaking (semantic names stay identical).

**Also missing semantic tokens** the audits keep hitting (add these so hardcoded values disappear):
- `--color-on-accent` (currently hardcoded `#fff` ~39×) — foreground on accent/danger fills.
- `--color-scrim` / overlay (currently `rgba(0,0,0,0.6)` scattered across map/token labels).
- `--radius-pill` (currently `999px`/`100px` magic numbers).
- `--space-5` (1.5rem, used ad hoc), and a `--shadow-popover` (token-editor/mention use one-off shadows).

## 2. File structure: ITCSS-lite layering (not one mega-file)

The problem isn't that CSS is global — it's that it's **unordered and unsplit**. ITCSS (Inverted
Triangle CSS, Harry Roberts) orders CSS by reach, widest/most-generic first, narrowest/most-specific
last, so specificity only ever increases down the file and nobody fights the cascade. Recommended split:

```
src/styles/
  1-settings/    tokens.css            (primitive + semantic tokens; the ONLY place colors live)
  2-generic/     reset.css             (box-sizing, body, button/input font — from style.css top)
  3-elements/    (bare element defaults, if any)
  4-objects/     layout.css            (app-shell, workspace-shell, workspace-area — layout skeletons)
  5-components/  button.css tabs.css field.css panel.css list-row.css tree.css chip.css …
                 + one file per real view component (map-viewer.css, calendar-form.css, …)
  6-utilities/   (spacing/visibility helpers, if wanted)
  index.css      @import in the above order
```

This is compatible with keeping plain CSS (no build change needed — just `@import` order). It turns
"scroll 4,584 lines hoping to find a reusable class" into "open `components/button.css`".

## 3. Naming: keep BEM, it's already the de-facto convention here

The codebase already uses BEM-ish `block__element--modifier` (`.emd__item--active`,
`.map-pin-tree__group-header`). Keep it. The fix isn't renaming — it's **deduplicating blocks that
are the same object** (see the list-row/input/button clusters the audits are cataloging) into shared
objects, and making view classes *compose* shared ones (CUBE CSS's "Composition" idea) instead of
redeclaring border/radius/background every time.

## 4. Primitives-first component library (the actual deliverable)

The `primitives.tsx` system is the right seed but under-built (7 primitives, used in 2 files). The
consolidation index will define the target library. Rule for the future, to stop the spaghetti:

> **New UI must compose an existing primitive/object first. Rolling a new `.foo__button` /
> `.foo__input` / `.foo__row` is only allowed when no primitive fits — and then it gets added to the
> library, not buried in a view.**

Primitives the audits already show are needed beyond the current 7: **ListRow** (the single most
duplicated pattern — every view has one), **Pill/Chip**, **Panel/Popover** (floating card with
shadow), **Toolbar**, **IconButton**, **Tree** (generalize the gold-standard pin tree — behavior
unchanged, per project rule).

## 5. How this maps to the effort's phases

1. **Now (this research):** per-view audits catalog every component + class + duplication + hardcoded color.
2. **Consolidation index** (`component-library.md`): the canonical library — each primitive with its
   role, canonical class, and the list of duplicate classes it absorbs (with `file:line` occurrences).
3. **Non-goal / later:** emit the restructured `styles/` tree above, add the primitive palette +
   missing semantic tokens, migrate views onto primitives, then themes become trivial palette files.

## Sources
- [CUBE CSS — principles](https://cube.fyi/principles.html)
- [Design Token Architecture 2026 (Tim Graf)](https://timgraf.com/ui/design-token-architecture-2026-the-strategic-blueprint-for-scalable-design-systems/)
- [Design Tokens vs CSS Variables (DSP)](https://designsystemproblems.com/token-management/design-tokens-vs-css-variables/)
- [Design Tokens and Theming Architecture (Sujeet Jaiswal)](https://sujeet.pro/articles/design-tokens-and-theming)
- [Structuring Large CSS Codebases with ITCSS](https://namastedev.com/blog/structuring-large-css-codebases-with-itcss-methodology/)
- [Managing Global Styles in React with Design Tokens (UXPin)](https://www.uxpin.com/studio/blog/managing-global-styles-in-react-with-design-tokens/)
- [W3C DTCG / Style Dictionary light-dark workflow (Always Twisted)](https://www.alwaystwisted.com/articles/a-design-tokens-workflow-part-7)
