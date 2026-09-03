# `src/style.css` — master block map (4,584 lines, single file)

Every top-level class block with its first line, grouped by owning view. This is the backbone for
the consolidation index: it shows what lives where and which blocks are cross-cutting (owned by no
single view = must become shared objects/primitives).

## Cross-cutting / layout & shared (owned by NO view → shared objects layer)
| Block | Line | Note |
|---|---|---|
| `.app-shell` | 22 | Layout skeleton (grid). Object layer. |
| `.workspace-shell` | 143 | Layout skeleton. Object layer. Imports `primitives.tsx`. |
| `.workspace-area` | 280 | Layout skeleton (sidebar+main+toolbar). Object layer. |
| `.language-switcher` | 241 | Small control. |
| `.theme-toggle` | 254 | Small control. |
| `.welcome-screen` | 353 | Entry screen. |
| `.new-project` | 410 | Dialog/card — duplicates `.ui-panel`. |
| `.btn` / `--primary` / `--danger` | 474/490/501 | **Generic button — direct rival of `.ui-button`. Central dedup target.** |
| `.mention-chip` / `.mention-suggest` | 1801/1814 | Chip + popover — shared across editors. |
| `.tag-field` | 1852 | Chip pattern. |
| `.emoji-picker-host` / `.emoji-picker` | 4404/4490 | Shared picker. |
| `.icon-picker` | 4423 | Shared picker. |

## Entities view
| Block | Line |
|---|---|
| `.emd` (master-detail) | 519 |
| `.entity-detail` | 673 |
| `.relations-tab` | 3377 |
| `.relation-types-row` | 2567 |
| `.backlinks` | 2608 |
| `.entity-picker` | 3447 |
| `.effect-editor` | 3235 |

## Search view
| Block | Line |
|---|---|
| `.gsearch` | 868 |

## Calendar view
| Block | Line |
|---|---|
| `.cal-form` / `.cal-section` | 985 / 1027 |
| `.cal-month-grid` … `.cal-remove-btn` | 1102–1159 |
| `.cal-month` / `.cal-year-nav` / `.cal-year-popout` | 2655 / 2687 / 2692 |
| `.cal-grid` | 2806 |
| `.cal-link` / `.cal-tabs` / `.cal-tab` | 2885 / 2934 / 2941 |
| `.cal-datefield` / `.cal-year-input` / `.cal-hint` | 2962 / 2979 / 2989 |
| `.cal-era-*` / `.cal-yearmode` / `.cal-start` | 2995–3066 |
| `.cal-dateinput` (+`--snap`) | 3094 / 3129 |
| `.event-form-fields` | 3132 |
| `.cal-inline-event-editor` | 3340 |

## Maps view (LARGEST — ~1,600 lines across two regions)
| Block | Line |
|---|---|
| `.map-viewer` / `.map-empty` | 1178 / 1252 |
| `.map-pin` (+ modifiers) | 1261–1288 |
| `.map-token` (+ selected) | 1324 / 1457 |
| `.token-editor` | 1495 |
| `.map-side-collapsed` / `.map-side-collapse-btn` | 1669 / 1689 |
| `.map-token-list` | 1700 |
| `.map-pin-tree` (+collapsed) | 1754 / 1774 — **gold standard, do not change** |
| `.pin-icon-picker` / `.pin-icon-btn` | 1865 / 1874 |
| `.grid-state-add-btn` / `.grid-state-del-btn` | 1893 / 1905 |
| `.map-folder-tree` | 1939 |
| `.map-toolbar` / `.map-tool-btn` / `.map-tool-group` / `.map-tool-flyout` | 2149 / 2195 / 2213 / 2224 |
| `.grid-controls-*` / `.grid-color-*` / `.grid-toggle` / `.grid-type-btn*` / `.grid-state-name` | 2254–2418 |
| `.map-context-menu` | 2418 |
| `.map-pin-editor` | 2461 |
| `.pin-entity-links` / `.pin-entity-chip` / `.pin-entity-add*` | 2535–2552 |
| `.maps-sidebar` / `.maps-sidebar-tabs` / `.maps-layer-section` | 3489 / 3520 / 3568 |
| `.layer-panel` | 3584 |
| `.fog-tools` | 3681 |
| `.scene-switcher` | 3825 |

## Audio view
| Block | Line |
|---|---|
| `.audio-soundboard-window` | 191 |
| `.soundboard-board` | 3981 |
| `.channel-row` | 4013 |
| `.clip-button-wrap` / `.clip-button` (+`--empty`) | 4229 / 4231 / 4264 |
| `.clip-editor` | 4303 |

## Graph view
Graph chrome largely lives in its own file `src/styles/components/graph.css` (139 lines) — see graph audit.

---
### Immediate cross-view observations (to verify against agent reports)
- **Buttons** are declared at least 4 independent ways: `.ui-button` (primitives), `.btn`,
  `.cal-add-btn`/`.cal-remove-btn`, `.map-tool-btn`, `.grid-type-btn`, `.token-editor button`,
  `.pin-entity-add-btn`, `.clip-button`. → one `Button` primitive + tone/size variants.
- **Tabs** declared ≥3 ways: `.ui-tabs`, `.entity-detail__tab`, `.cal-tab`, `.maps-sidebar-tabs`,
  `.map-side-collapsed__tab`. → one `Tabs` primitive.
- **Chips/pills** ≥5 ways: `.gsearch__facet`, `.tag-field__chip`, `.mention-chip`,
  `.pin-entity-chip`, `.map-token__counter`. → one `Chip` primitive.
- **Tree** ≥3 ways: `.map-pin-tree` (canonical), `.map-folder-tree`, `NestedTree`. → generalize pin tree.
- **Pickers** are already somewhat shared (`.icon-picker`, `.emoji-picker`, `.pin-icon-picker`) but
  `.pin-icon-picker` looks like a 4th variant of the same idea.
