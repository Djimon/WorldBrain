# Fast Theme-Switching & Community-Built Themes — architecture research

> Companion to `_css-architecture-methodology.md`. That doc covers structure; THIS one is specifically
> about the end goal you named: users switch themes instantly, and *the community can build and share
> themes* — the Obsidian model. Researched Aug 2026. Good news up front: **Worlds and Beyond is closer to
> this than it looks, and Tauri/WebView2 (Chromium/Edge) lets us use the newest CSS for it.**

## 1. What actually makes themes "community-buildable" — the 3 requirements

Studying Obsidian (400+ CSS variables, thousands of community themes) and VS Code, a themeable app
needs exactly three things. None of them is exotic:

1. **A public, documented variable contract.** A theme author must be able to change the whole look by
   setting a *known, stable, named* set of CSS variables — without reading component source. Obsidian
   documents 400+ vars in foundation → semantic → component layers; that documentation *is* the theming API.
2. **A theme = one CSS file that only overrides those variables.** No component markup, no selectors into
   internals. In Obsidian a theme is literally `theme.css` redefining variables under a body class. If a
   theme has to target `.map-token__counter-btn` to restyle a button, theming is broken — that's why the
   consolidation (one `Button`, one `ListRow`, etc.) is a *prerequisite* for community theming, not a nicety.
3. **A switch that re-points variables at the root.** Toggle a class/attribute on `:root`/`<body>`; every
   `var()` re-resolves instantly, no re-render, no JS touching components. Worlds and Beyond **already has this**
   (`[data-theme='dark']` + `ThemeToggle.tsx`). A theme is just another value of that attribute.

**The blocker for us is #1 and #2, not #3.** Right now a theme author *cannot* restyle Worlds and Beyond by
setting variables, because ~40 `#fff`, `#c0392b`, `rgba(0,0,0,.6)` etc. are baked into components and the
same widget exists as 5 unrelated classes. Fix that (the consolidation) and community theming falls out.

## 2. The token layering that community themes require (why the primitive layer matters)

Obsidian's variables are layered foundation → semantic → component. This is the same three-tier model from
`_css-architecture-methodology.md`, and it's what lets a theme author work at whatever depth they want:

```
PRIMITIVE / foundation   --red-700, --gray-100, --mono-000…   ← a "palette" theme redefines ONLY these
SEMANTIC / role          --color-accent: var(--red-700)        ← a "remap" theme repoints these
COMPONENT (opt-in)       --button-bg: var(--color-accent)      ← a surgical theme tweaks one component
```

- **Easy theme** ("new color scheme"): author redefines the ~15 **primitive** palette values → whole app
  recolors. This is your stated dream: *"einfache Color-Variable-Definitionen, die direkt das ganze Bild ändern."*
  It only works if a primitive layer exists — today it doesn't, so add it.
- **Advanced theme**: author repoints semantic tokens (e.g. make `--color-surface` warmer than the palette).
- **Surgical theme/snippet**: author overrides one component token. Obsidian's whole snippet ecosystem is this.

## 3. Concrete recommendation for Worlds and Beyond

**A. Add the primitive palette layer under the existing semantic tokens** (non-breaking — semantic names stay):
```css
:root {
  /* ① primitives — the ONLY raw values; a theme file overrides just these */
  --pal-accent: #7b1d1d;  --pal-accent-strong: #5f1515;
  --pal-ink: #1f2326;     --pal-paper: #ffffff;  --pal-mist: #f7f8fa;  /* … */
  /* ② semantic — unchanged names, now point at primitives */
  --color-accent: var(--pal-accent);
  --color-surface: var(--pal-paper);
  --color-on-accent: var(--pal-paper);   /* NEW: kills the 39× hardcoded #fff */
  --color-scrim: rgb(0 0 0 / 0.6);       /* NEW: kills scattered rgba scrims */
}
```

**B. Generalize `data-theme` from a boolean to a name.** Today `[data-theme='dark']`. Make it
`[data-theme='bastion-dark']`, `[data-theme='midnight']`, `[data-theme='parchment']`… `ThemeToggle` becomes
a theme *picker*. Each theme = one CSS block/file overriding primitives (and optionally semantics).

**C. Use `light-dark()` — WebView2 supports it.** Tauri runs Chromium/Edge, so `light-dark()` (Edge/Chrome
111+) is safe. It lets a single palette declare both modes without a second `[data-theme]` block, halving
theme-file size and letting a theme follow the OS preference for free:
```css
--pal-paper: light-dark(#ffffff, #1f2428);
```

**D. Wrap the cascade in `@layer`.** `@layer reset, tokens, objects, components, theme, user;` guarantees a
theme (and later user snippets) always wins over component CSS *without specificity hacks* — the exact
mechanism that makes Obsidian snippets reliable. This is the single best safeguard for a community-theme future.

**E. Define the theming contract doc.** Once consolidated, publish `docs/theming/variables.md` — the public
list of themeable variables (this becomes the community's API). A theme author reads only that, never `src/`.

**F. (Later, optional) A Style-Settings-style UI.** Obsidian's "Style Settings" plugin auto-builds a settings
panel from annotated CSS comments so users tune variables in-app. Overkill for now, but the annotated-variable
approach is worth keeping in mind so the door stays open.

## 4. What NOT to do
- Don't reach for CSS-in-JS / runtime style objects (the audits already found inline `style={{}}` smells in
  audio/graph) — runtime-generated styles can't be overridden by a community theme file. Variables + plain CSS
  is precisely what makes Obsidian themeable.
- Don't let themes target component internals. If a theme *needs* to, that component is missing a token — add
  the token instead. This keeps themes from breaking on every refactor.

## 5. Sequencing (fits the existing plan)
The theming goal is **downstream of the consolidation**, not parallel: (1) audits → (2) component library →
(3) restructure CSS + add primitive palette + missing semantic tokens + `@layer` → (4) publish the variable
contract → **(5) themes become one-file palette overrides the community can author.** Step 5 is cheap once 1–4 exist.

## Sources
- [Obsidian — Themes & CSS customization](https://deepwiki.com/obsidianmd/obsidian-help/7.3-themes-and-css-customization)
- [Obsidian — CSS Variables reference (foundation/semantic/component layers, 400+ vars)](https://deepwiki.com/obsidianmd/obsidian-developer-docs/3.3-css-variables-reference)
- [Obsidian — Theme files & structure (theme.css/manifest/versions)](https://deepwiki.com/davidvkimball/obsidian-sample-theme-plus/5.1-theme-files-and-structure)
- [Obsidian Style Settings plugin (variable-tuning UI)](https://github.com/community-archive/obsidian-style-settings)
- [Inverted themes with light-dark() — Dave Rupert (2026)](https://daverupert.com/2026/04/inverted-light-dark/)
- [Design Tokens That Scale in 2026 — Tailwind v4 + CSS vars](https://www.maviklabs.com/blog/design-tokens-tailwind-v4-2026/)
- [How to Structure Design Tokens for Light and Dark Mode](https://dev.to/hasansarwer/how-to-structure-design-tokens-for-light-and-dark-mode-11b2)
