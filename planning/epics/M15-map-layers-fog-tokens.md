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

- **D7 — Der Pin-Baum ist der GOLD-STANDARD; sein Frontend bleibt unverändert.** (User-Entscheidung 2026-07-22)
  `src/ui/MapViewer.tsx:87-390` (Pin-/Ordnerbaum: Drag&Drop für Elemente und Ordner, Collapse ▼/▶,
  Zähler, Suche, einklappbares Panel) ist die **verbindliche Referenz für jede Baum-UI im Projekt**.
  - **Schritt 1 (erwünscht): den Pin-Baum generalisieren/kapseln**, damit andere davon profitieren —
    also die geteilte Komponente **aus dem Pin-Baum extrahieren**, nicht danebenstellen und neu erfinden.
  - **Harte Bedingung:** Dabei darf sich am **Pin-Baum-Frontend nichts ändern** — kein sichtbarer
    oder spürbarer Unterschied in Aussehen und Bedienung. Reiner, verhaltenserhaltender Refactor;
    vorhandene Pin-Tests bleiben grün. Jede Regression dort ist ein Blocker.
  - **Schritt 2:** Der Map-Ordnerbaum konsumiert **dieselbe** Komponente → 1:1-Gleichheit ergibt sich
    automatisch, statt nachgebaut zu werden.
  - **Verboten:** die Pin-Baum-**UX** ändern; Zusatz-Controls, die er nicht hat (z.B. **kein permanenter
    „verschieben"-Button** — im Pin-Baum wird gezogen).
  - Richtung ist einseitig: **Map adaptiert Pin**, nie umgekehrt. Bei Abweichung gewinnt immer der Pin-Baum.
  - Gilt auch für künftige Bäume (Entity-/Lore-Ordner, Audio-Scenes).

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
- S04 #276 (Fog): FERTIG 2026-07-18 (mit S03 gemergt — kaum unabhängig umsetzbar).
  `createFogLayer` (fog-Layer `z_order = max+1`, voll deckende Maske). `FogTools.tsx`
  (Pinsel/Rechteck, Aufdecken=destination-out / Verdecken=source-over, Pinselgröße +
  Weichzeichnung). `FogMaskCanvas.tsx` (Canvas-Maske, Pointer down/move/up in Map-Koordinaten,
  persist via `updateLayer(mask_data)` on stroke-end). MapViewer rendert Fog-Layer als
  Canvas-Overlays über Image-Layern und UNTER Grid/Pins (Pins bleiben sichtbar/klickbar);
  hidden (`visible=0`) wird nicht gerendert. Fog-Layer-Auswahl elegant über die eine
  LayerPanel-Liste ("Bemalen"-Button je Fog-Row -> `editingFogLayerId`, MapViewer malt genau
  den). Add-Fog wählt den neuen Layer direkt zum Malen. Progressive Reveal = `visible=0`
  Toggle im LayerPanel (bestand). Tests: `m15-s04-fog-layer` (Komponenten+Service),
  `m15-s04-fog-in-mapviewer` (Container-Integration), `m15-s03-s04-layer-add-preserves-map`
  (Pins/Grid überleben). Epic-"Out of scope" (LoS/dyn. Licht/Undo/per-Pixel-Session) bleibt
  V1-Grenze — nicht Teil von #276.
- S05 #277 (Folders): NICHT implementiert — RED-Tests, `map-folder-service` komplett Stubs,
  `MapFolderTree.tsx` unmounted.
- S06 #278 (Tokens): DONE 2026-07-20 — `map-token-service` implementiert (createToken +
  Auto-Token-Layer via neuem `map-layer-service.createTokenLayer` z_order=max+1, listTokens
  mit Session-Scoping (kein sessionId=nur Base session_id NULL; mit sessionId=Base+Session),
  moveToken/setCounter/setStatusChips/updateToken/deleteToken, status_chips_json JSON.parse
  mit Safe-Fallback []). Schema `map_tokens` bestand bereits (applyMapSchema, CREATE IF NOT
  EXISTS -> Runtime legt Tabelle beim naechsten Init an, kein ALTER). Tests
  `m15-s06-map-tokens` 10/10, tsc 0, lint 0. Token-Render/Drag-UI = S07 (#279).
- S07 #279 (Token-UI/Export): DONE 2026-07-20. Render: `MapTokenLayer.tsx`
  (`MapToken` = runde Portrait-Platzhalter-Initiale + farbiger Ring + Namens-Pille
  + Counter-Badge (nur wenn counter_value gesetzt) + Status-Chip-Bogen; skaliert
  `scale(1/scale)` wie Pins). Interaktion in MapViewer: Tokens laden via `listTokens`,
  Direkt-Drag (pointer down/move/up) -> `moveToken`; "Token"-Tool (🧙) + Kartenklick
  legt Ad-hoc-Token als Base-Placement an (`createToken`, Token-Layer auto). Editor:
  `TokenEditor.tsx` (gerendertes Panel, KEIN prompt/alert/confirm) fuer Name/Entitaet/
  Ringfarbe/Counter/Chips add-remove -> updateToken/setCounter/setStatusChips. Player-
  Export: `generatePlayerMapHtml` erweitert (optionale `layers`/`tokens`, nur
  `player_visible=1`, Fog nur wenn `visible=1`, Tokens nur auf player-visible Token-Layer,
  alle Strings via `escHtml` escaped, CSP-Meta ergaenzt) -- ABWAERTSKOMPATIBEL (markers
  optional). HINWEIS: `generatePlayerMapHtml` hat aktuell KEINEN UI-Caller (Export-UI war
  nie gemountet, Vorzustand) -> Extension auf Funktionsebene, wie das Feature heute existiert.
  Portrait: kein Entity-Bildfeld im Schema -> Initiale-Platzhalter. Tests:
  `m15-s07-token-layer` (11) + `m15-s07-player-export-tokens` (6), tsc 0, lint 0, keine
  Regression (fog/layer/m5-s17). Additiv: Pins/Grid/Fog/Maps unberuehrt.
- Hinweis: Schema für `map_layers`/`map_tokens`/`map_folders` existiert bereits (landete vor
  den Services).

## Amendment 2026-07-20 — Token = Map-eigenes Konstrukt (Requirement)

Klarstellung des Users, korrigiert **D4**:

- **Token ist ein rein Map-eigenes Design-Element** und hat NICHTS in der Wissens-/Lore-Datenbank
  (Entities) zu suchen. `map_tokens.entity_id` **entfaellt** (D4 war hier falsch). Name = Freitext
  (`label`). Betrifft geliefertes S06/S07 (#278/#279) -> Rework in **#298**.
- **Bildbasierte Render-Modi** (Upload waehlt den Modus):
  - `token` — Bild mit runder **Maske + farbigem Rahmen**; Ausschnitt unter der Maske verschiebbar
    (`art_offset_x/y`), `ring_color` = Rahmenfarbe.
  - `plain` — **ganzes Bild** als Artwork (Monster/Encounter/echte Figuren), keine Maske.
  - Neue Spalten: `art_asset_id`, `render_style` (`'token'|'plain'`), `art_offset_x/y`.
  Story: **#298** (M15, `area: maps`).
- **Zwei Token-Klassen ueber ein Feld je Token** (keine getrennten Layer): Spieler-Token vs
  DM-Token (Monster/NPC). Bewegungsrechte fuer Multiplayer als **`controller`** (`'dm'` Default |
  `'players'`) + optional **`owner_player_id`** (nur dieser Spieler; DM immer). NICHT jetzt umsetzen —
  Datenmodell + server-seitige Durchsetzung (EPIC-016 Decision 8) als Story **#299** im Milestone
  **M10 - Multiplayer**. #298 (M15) und #299 (M10) sind gegenseitig verlinkt.

**#298 DONE 2026-07-20:** Schema `map_tokens` — `entity_id` raus, `art_asset_id`/`render_style`
(`'token'|'plain'`)/`art_offset_x`/`art_offset_y` rein (map-schema + idempotente ALTERs in db-init).
Service entkoppelt (kein `entity_id` mehr; create/update mit Art-Feldern). `MapToken`: token-Modus =
Bild in runder Maske + Rahmen (`object-fit:cover` + `objectPosition` aus art_offset in %), plain-Modus =
ganzes Artwork ohne Ring, Initiale-Platzhalter ohne Bild. `TokenEditor`: Entity-Picker raus; Bild-Upload
(Tauri-Dialog via `onPickTokenArt`-Callback aus WorkspaceShell -> `copyMapAsset`), Modus-Umschalter,
Crop-Drag (nur token-Modus, live, persistiert %-Offset). Tests: `m15-s08-token-render-modes` (12) +
angepasste s06/s07. tsc 0, lint 0, keine Regression. Offene Detail-Entscheidungen (Zoom unter Maske,
Default-Modus, plain-Footprint) bleiben #298 Open-Decisions.

## Decision 2026-07-20 — Status-Chip Icon-Sets (#300, Design geklaert)

Praezisiert D4 ("plugin/user icon set"):
- **Icon-Set-Registry** (Core + Plugin, analog `relation-type-registry` / `plugin-entity-service`) —
  KEIN Fake-Default-Plugin. Default-Set = Core, fest im App-Code registriert (laeuft ohne Plugin);
  Plugins registrieren zusaetzliche Sets ueber dieselbe API. Icon-Technik: **SVG/PNG oder Icon-Font**.
- **Default-Set V1:** poisoned, armour-break, bleeding, asleep, stunned, blinded.
- **Picker** = Grid-Popover mit Gruppen (default / plugin_name / ...), Reiter nur als
  Scroll-Sprung-Anker, Trennlinie + Gruppenname je Gruppe.
- **Render:** `token`-Modus -> Bogen ueber dem Token (waechst bis Vollkreis); `plain`-Modus ->
  Chips nebeneinander an der oberen Bildkante, zentriert. Chip-Groesse skaliert mit Token-`scale`.
- **Default-Kontrast:** Default-Icons weiss + schwarzer Stroke/Schatten; `color` optional fuer
  eigene Faerbung.
- Multiplayer (spaeter, #299): Spieler duerfen Chips/Tokens setzen; "in Benutzung"-Umrandung
  in Spielerfarbe als Presence-Signal.

**2026-07-24 — #300 implementiert.** Icon-Set-Registry (Map-backed, Core bei Modul-Load geseedet,
analog `relation-type-registry.ts`), `IconPicker` (Grid-Popover, Gruppen, Scroll-Sprung-Tabs),
`MapTokenLayer` (Chip-Icons ueber die Registry aufgeloest inkl. Fallback fuer alte Literal-Glyphs;
Bogen- vs. Reihen-Layout je `render_style`, waechst bis Vollkreis, Groesse skaliert mit Token-`scale`),
`TokenEditor` (Freitext-Icon-Feld durch IconPicker-Trigger ersetzt). CORE_ICON_SET von 14 auf die
spezifizierten 6 V1-Icons gekuerzt (ueberzaehlige SVGs waren ungenutztes Scaffolding). 46 Tests gruen
(`issue-300-icon-registry`, `issue-300-icon-picker`, `m15-s07-token-layer`), tsc/lint 0, keine Regression.
Issue #300 geschlossen.

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
