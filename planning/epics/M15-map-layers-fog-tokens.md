# EPIC-023: Map Layers, Fog of War & Tokens

Milestone: **M15 - Play & Presentation Tools** (GitHub #18). Area: `area: maps`.
Extends the verified EPIC-008 (Map Import & Annotation) — does **not** replace it.

## Goal

Turn a map from a single static image into a **layered composition** the DM stacks,
reveals, and plays on: multiple image layers with opacity, hand-painted Fog-of-War
layers revealed progressively, and movable session tokens with counters and status
chips. Maps become organizable in a nested folder tree.

## Scope

- `map_layers` stack: `image` / `fog` / `token` layers with opacity, z-order, DM show/hide, player-visible flag.
- Multiple image layers per map, stacked with per-layer opacity.
- Fog-of-War as raster-mask layers, painted with brush (size + feather) and rectangle, in reveal/cover modes; multiple fog layers toggled show/hide for progressive reveal.
- `map_tokens`: movable session pieces with portrait + colored ring + name, one counter, N status chips.
- Nested folder tree for organizing maps (`map_folders`).
- Per-layer `player_visible` feeds the existing player-map export (progressive reveal).

## Out Of Scope

- Dynamic lighting / line-of-sight (fog is manual paint only — no automated vision).
- Initiative / turn order / combat automation (tokens carry a counter + status chips, no engine).
- Token auto-binding to character-sheet fields (counter is token-local/ad-hoc in V1).
- Cross-session token position history (position is one session-scoped value, not a timeline).
- Rendering-engine swap (see **Rendering Reality** — we build on the existing Canvas/img MapViewer).
- Per-shape editing of a painted fog region (raster mask is one representation; edit = repaint/erase).

## Rendering Reality (READ THIS — do not re-derive from stale notes)

The EPIC-008 story note "E8-S02: Leaflet MapContainer+ImageOverlay" is **stale and misleading**.
Actual current state, verified in code 2026-07-11:

- **`src/ui/MapViewer.tsx` uses NO Leaflet.** It renders a plain `<img>` with CSS `transform: translate/scale`
  for zoom/pan, `<div>` overlays for pins, `<svg>` for ruler/radius, and Canvas layers
  (`GridLayer` / `CellStateLayer` / `PaintInteractionLayer` from `./MapGrid`). This IS the
  decided Canvas-2D architecture (EPIC-008: no map framework, minimal deps, no geo-map abstractions
  fighting fantasy pixel coordinates).
- **All new layer/fog/token rendering builds on this MapViewer path** — plain `<img>` layers stacked in
  the existing CSS-transform container, a `<canvas>` overlay for the fog mask, `<div>`/`<canvas>` for
  tokens. **No Leaflet, no new rendering engine.**
- **Debt resolved 2026-07 (#291):** `src/blocks/MapEmbedBlock.tsx` migrated off `react-leaflet` onto a
  plain `<img>`; `leaflet`/`react-leaflet`/`@types/leaflet` removed from `package.json`. Guard test's
  canvas-assertion also corrected — checked for a literal `<canvas`/`MapCanvas` substring in
  `MapViewer.tsx`, but the real grid rendering goes through `GridLayer`/`MapGrid.tsx` under a different
  name; widened to accept `GridLayer` too. Guard test (`tests/issue-107-no-react-leaflet.test.ts`) now
  **7/7 green** (was 3/7); #107 got an honest verification comment. `GridOverlay.tsx` (an older,
  never-wired component superseded by `MapGrid.tsx`/`GridLayer`) was marked `.deprecated`. The map
  subsystem's authoritative renderer is still MapViewer, as above.

## Decisions

- **D1 — Layer stack (`map_layers`).** One uniform primitive. Columns:
  `id`, `map_id`, `layer_type` (`'image' | 'fog' | 'token'`), `name`,
  `asset_id` (image layers only, else NULL), `mask_data` (fog layers only: base64 PNG dataURL, else NULL),
  `opacity` REAL 0–1 DEFAULT 1, `z_order` INTEGER DEFAULT 0, `visible` INTEGER DEFAULT 1 (DM show/hide),
  `player_visible` INTEGER DEFAULT 0, `created_at`. "Mehrere PNGs mit Opacity" and "Fog/Token als Layer"
  are the same primitive with a different `layer_type`.
- **D2 — Nested map folder tree (`map_folders`).** Columns: `id`, `parent_id` (nullable = root),
  `name`, `created_at`. Maps gain `maps.folder_id` (nullable). Arbitrary nesting. This organizes the
  **maps themselves** — distinct from the existing per-map pin folder tree (`group_name` with "/").
- **D3 — Fog of War = raster mask per fog layer.** Stored as `map_layers.mask_data` (base64 PNG dataURL,
  alpha = covered). Tools: brush (adjustable size + edge feather) and rectangle drag. Two modes per stroke:
  **cut/reveal** (erase mask = show map) and **set/cover** (paint mask = hide map). Multiple fog layers per map;
  DM reveals progressively by toggling each fog layer's `visible` off. No separate session-fog table.
- **D4 — Tokens (`map_tokens`).** Own table, movable, distinct from static `map_markers`. Columns:
  `id`, `layer_id` (→ a `map_layers` row with `layer_type='token'`), `map_id`, `entity_id` (optional; portrait/name source),
  `label` (fallback name), `x` REAL, `y` REAL (pixel position, movable), `ring_color` (optional, cosmetic only —
  no forced faction/status mapping in V1), `counter_label`, `counter_value` REAL (one counter, token-local, NOT auto-bound
  to any char-sheet field), `status_chips_json` (`[{icon, color?, text?}]`, N chips from a plugin/user icon set — no D&D hardcode),
  `session_id` (session-scope; NULL = base placement), `created_at`.
- **D5 — `maps.asset_id` removed; base image becomes the bottom `image` layer.** A map is now a pure container.
  No backward-compat shim (dev data disposable): schema drops `asset_id`, map creation inserts one `image` layer.
- **D6 — `player_visible` per layer feeds the existing player-map export.** Fog/token layers are naturally
  player-facing; a GM-notes image layer stays hidden. Reuses the EPIC-008 visibility projection —
  export shows only layers with `player_visible = 1` (and fog `visible` state as revealed).

## Token visual model (from concept screenshot)

Circular portrait (from `entity_id` image, else placeholder) + colored ring (`ring_color`) + name pill below.
Counter rendered as a numeric badge at the token's top edge. Status chips rendered as an arc of icon chips
above the token. One counter, N status chips.

## Stories

| Story | Issue | Prio | Kern |
|---|---|---|---|
| M15-S01 | #273 | p1 | `map_layers` schema + service; drop `maps.asset_id`, base image → bottom image layer; layer CRUD + reorder |
| M15-S02 | #274 | p1 | Layer-Panel UI: stack list, opacity slider, show/hide, z-order drag, player-visible toggle |
| M15-S03 | #275 | p1 | Multi-image layers: import N PNGs as image layers, stacked render with per-layer opacity |
| M15-S04 | #276 | p1 | Fog-Layer + paint tools: raster mask, brush (size/feather) + rectangle, reveal/cover modes, multiple fog layers |
| M15-S05 | #277 | p2 | Map folder tree: `map_folders`, nested, drag map into folder, folder-scoped map list |
| M15-S06 | #278 | p1 | `map_tokens` schema + service: token CRUD, session position, counter + status chips |
| M15-S07 | #279 | p1 | Token layer UI: portrait+ring+name render, drag-move, counter badge, status-chip arc; player-visible + fog into player export |

**Dependency axis:** S01 first → unblocks S02, S03, S04, S06. S06 → S07. S05 independent.

### Reality 2026-07-18 (Code = Truth) — Stories-Tabelle oben überzeichnet Liefergrad

Verifizierter Status aus git. Die Stories-Tabelle bildet Plan/Scope ab, NICHT den Ist-Stand.

- S01 #273: DONE (ff69bc8) — `map_layers`-Schema + `map-layer-service` CRUD/reorder,
  `maps.asset_id` dropped.
- S02 #274: `LayerPanel`-Component gebaut + getestet (8350747). War NIRGENDS gemountet ->
  #294 (P0). GELÖST 2026-07-18: LayerPanel dockt im Maps-Bereich unter dem `MapViewer`
  (`WorkspaceShell` case 'maps', `.maps-layer-dock`), sichtbar sobald eine Karte gewählt ist.
  Mount-Verhaltenstest: `tests/m15-s02-layer-panel-mount.dom.test.tsx` (rendert das echte
  Panel im Maps-Container, nicht isoliert). Add-Image/Add-Fog-Handler verdrahtet 2026-07-18.
- S03 #275: Image-Layer-Stacking rendert (72234e8). `importImageLayer` implementiert
  2026-07-18: reuse des geteilten Asset-Copy (`map-asset.copyMapAsset`, denselben Flow nutzt
  auch `importMapImage`), neuer Image-Layer bei `z_order = max+1`. Add-Image-Button im
  LayerPanel verdrahtet (`WorkspaceShell.handleAddImageLayer`). Additiv — Pins/Grid/Cells
  bleiben (per `map_id`, kein `layer_id`). Rest offen: mehrfach-Stack-Feinschliff.
- S04 #276 (Fog): `createFogLayer` implementiert 2026-07-18 (fog-Layer bei `z_order = max+1`
  mit voll deckender Maske; Add-Fog-Button verdrahtet). OFFEN: Fog-Paint-Tooling
  (`FogTools`/`FogMaskCanvas`, Pinsel/Rechteck, Reveal/Cover) + MapViewer-Fog-Render.
- S05 #277 (Folders): NICHT implementiert — RED-Tests, `map-folder-service` komplett Stubs,
  `MapFolderTree.tsx` unmounted.
- S06 #278 (Tokens): NICHT implementiert — RED-Tests, `map-token-service` komplett Stubs.
- S07 #279 (Token-UI/Export): NICHT gestartet.
- Hinweis: Schema für `map_layers`/`map_tokens`/`map_folders` existiert bereits (landete vor
  den Services).

## Constraints propagated into every Story AC (verbatim)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown` or `as never` casts at call sites.
- AP-006: No `try/catch` around DB operations; errors propagate to the caller. (Exception: `JSON.parse` of DB `*_json` → safe fallback.)
- AP-008 (service gate): No `if (database)` / `if (service)` guards before service calls; optional props passed through unconditionally.
- UI stories additionally:
  - AP-003: No `prompt()` / `alert()` / `confirm()`; all input via rendered React UI or Tauri dialog API.
  - AP-008 (RTL): All RTL name/text queries anchored (`^…$`) where labels share a prefix; no bare `|<fragment>` catch-all; `||`/`??` fallbacks use `queryBy*`; multi-match uses `getAllBy*`/`within`.
  - No hardcoded UI strings: `useTranslation` + inline German default `t('key','Default')`.
  - At least one `.dom.test.tsx` asserting every interactive element + handler in AC exists in rendered output.
- Test files: ESM `import` only, no `require()` (AP-005).
- S07 (player export HTML): all user-supplied strings HTML-escaped before interpolation; CSP meta tag present (AP-004).

## Open Decisions

- None blocking. (Ring-color semantics, counter binding, status-chip source all resolved cosmetic/local in D4.)

## Sources

- EPIC-008 `planning/epics/M5-map-import-annotation.md` (base map system, verified).
- Concept screenshot: token sub-elements (counter badge, condition arc).
- Interview 2026-07-11 (Requirement Agent).
