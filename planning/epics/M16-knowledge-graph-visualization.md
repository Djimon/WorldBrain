# EPIC-025: Knowledge Graph Visualization

Milestone: **M16 - Knowledge Graph Visualization** (GitHub #19). Area: `area: search`.
Eigenständiger Wissensgraph als **eigener Menüpunkt**, auf einer WebGL-Engine.
Aus M15 herausgelöst 2026-07-23.

## Goal

Ein globaler, ästhetischer Wissensgraph über die ganze Welt — Galaxy-Glow-Look wie in den
Referenzbildern — in zwei Layout-Modi umschaltbar: **Ring** (geordnete Segmente je Typ, ruhiger
Default) und **Galaxy** (kraftbasierte Cluster je Typ). Beide zeigen **beide** Verbindungsarten
visuell getrennt: `relations` **dick/durchgezogen**, `@[Name](id)`-Verlinkungen **dünn/gedämpft**.
Skaliert auf **3.000–10.000 Nodes** (High-End-Worldbuilder mit Tausenden Einträgen).

## Substrat-Realität (verifiziert 2026-07-23 — WICHTIG)

- **`src/ui/GlobalEntityGraph.tsx` UND `src/ui/EntityGraph.tsx` sind gebaut, aber NIRGENDS gemountet.**
  `grep` bestätigt: keiner der beiden wird importiert/verdrahtet — beide sind totes Cytoscape-Gerüst
  (M2-S13 „verified" = nur Tests grün), nie in der Oberfläche. **In der App ist aktuell KEIN Graph sichtbar.**
- Konsequenz: kein „lauffähiges Feature migrieren". Wir **bauen beide Graphen frisch auf der neuen Engine,
  verdrahten sie endlich, und entfernen den toten Cytoscape-Code + die Dependency.** Die Cytoscape-Dateien
  dienen nur als Logik-Referenz (Ego-Tiefe/Filter).
- Verlinkungen existieren: `@[Name](id)`-Mentions in summary/properties, `parseMentions` (`PropertiesForm.tsx`),
  `BacklinksTab.tsx`. `getAllRelations` (`relation-service.ts`) liefert Relations.

## Decisions

- **D1 — Engine: `react-force-graph` (WebGL).** MIT-lizenziert → **frei für kommerzielle Nutzung, keine
  Gebühren** (der Grund gegen Cosmograph). Nutzt three.js/WebGL, schafft die 3k–10k-Node-Skala. Liefert
  Rendering, Force-Simulation (`d3-force-3d`, eingebaut), Pan/Zoom, Klick/Hover **out of the box** — wir
  konfigurieren, statt selbst zu zeichnen. Neue Deps: `react-force-graph-3d` (+ Peer `three`).
- **D2 — 3D-Engine „2D genutzt" + Bloom für den Glow-Look.** Kamera top-down/flach (z≈0), damit's aussieht
  wie die 2D-Referenzen; der Neon-/Galaxy-Schimmer kommt aus **Bloom-Post-Processing** (three.js
  `UnrealBloomPass`, via `postProcessingComposer`) + glühenden Node-Sprites. Ohne Bloom sieht die Engine
  „flat" aus — der Bloom macht den Unterschied „ok → geil".
- **D3 — Gruppierung nach Entity-Typ.** Galaxy-Cluster + Ring-Segmente nach `type`; Knotenfarbe = Typ-Farbe
  (EPIC-003-Mapping wiederverwenden falls vorhanden, sonst deterministische Palette).
- **D4 — Zwei Layout-Modi, umschaltbar; Ring = Default.** Ring geordnet/ruhig (für 2D-Scheue), Galaxy zuschaltbar.
- **D5 — Kanten-Kodierung.** `relation` = **dick** (~2.5px), durchgezogen, deckend. `mention` = **dünn** (~1px),
  gedämpfte Farbe, halbtransparent (~0.35). Verlinkungen sind den Relations visuell untergeordnet.
- **D6 — Knoten-Kodierung.** Glühende Sprites, Farbe = Typ-Farbe, **Größe nach `degree`** (min/max geklemmt).
- **D7 — Interaktion (von der Engine).** Klick auf Knoten → `onNavigate(entityId)`. Hover → Knoten + Kanten +
  Nachbarn hervorheben, Rest dimmen. Pan/Zoom via Engine-Kamera.
- **D8 — Layout vom Renderer entkoppelt.** Galaxy = Force-Sim-Konfiguration (Cluster-Kraft). Ring = deterministische
  Positionen, in der Engine **fixiert** (`fx`/`fy`, Force aus). So bleibt jede Story isoliert test-/baubar.
- **D9 — Relation subsumiert Mention.** Existiert zwischen zwei Knoten eine `relation`, wird eine `mention`
  desselben (ungeordneten) Paars verworfen — keine doppelte Linie.
- **D10 — LOD/Performance ist reale Anforderung (3k–10k Nodes).** Label-Culling beim Rauszoomen (Labels erst nah),
  `cooldownTicks`/`autoPauseRedraw` der Engine, Layout **vorberechnen** statt live jede Frame zu simulieren.
  Der Spike (S00) validiert, ob die Engine-Defaults + diese Config bei 10k in Tauri reichen.
- **D11 — Eine Engine für BEIDE Graphen.** Der globale Graph (S03) **und** der Ego-Graph (S07) laufen auf
  react-force-graph → einheitlicher Look. Danach **Cytoscape vollständig entfernt** (`cytoscape` +
  `@types/cytoscape` aus package.json, beide alten Komponenten gelöscht).

## Datenmodell (gepinnt für S02)

react-force-graph erwartet `{ nodes, links }`:
```
GraphNode = { id: string; type: string; label: string; degree: number }
GraphLink = { source: string; target: string; kind: 'relation' | 'mention' }
GraphModel = { nodes: GraphNode[]; links: GraphLink[] }
```

## Stories

| Story | Issue | Kern (ein Verhalten) | hängt an |
|---|---|---|---|
| M16-S00 | #320 | **Spike:** react-force-graph-3d + Bloom + ~10k synthetische Nodes in echter Tauri-WebView flüssig? (p0) | — |
| M16-S01 | #288 | Mention-Kanten-Extraktion (`buildMentionEdges`, reine Fn) — unverändert | — |
| M16-S02 | #317 | Graph-Datenmodell `buildGraphModel` → `{nodes, links}` (Typ+degree, Relation/Mention, D9-Subsumption) | S01 |
| M16-S03 | #289 | **Globaler Graph auf react-force-graph** + eigener Menüpunkt: Node/Link-Styling (D5/D6) + Bloom (D2) + Klick/Hover + LOD-Config (D10) | S00, S02 |
| M16-S04 | #318 | **Galaxy-Modus:** Cluster-nach-Typ-Kraft in der eingebauten Force-Sim | S03 |
| M16-S05 | #290 | **Ring-Modus:** deterministische Radial-Positionen, in der Engine fixiert (fx/fy) | S03 |
| M16-S06 | #319 | Controls: Switcher Galaxy⇄Ring (Ring=Default) + Verlinkungen-Toggle + Legende | S04+S05 |
| M16-S07 | #321 | **Ego-Graph auf dieselbe Engine** + in Entity-Detailseite verdrahten; **Cytoscape komplett raus** | S03 |

**Achse:** S00 → S01 → S02 → S03 → (S04, S05) → S06 → S07.

## Constraints (verbatim in jede betroffene Story-AC)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown`/`as never`.
- AP-006: No `try/catch` around DB operations; errors propagate. (Ausnahme: `JSON.parse`/Mention-Parse → safe fallback.)
- AP-008 (service gate): No `if (database)`/`if (service)` guard before service calls.
- UI-Stories (S03/S06/S07): AP-003 (no `prompt`/`alert`/`confirm`); AP-008 RTL (anchored queries); keine hardcodierten UI-Strings (`useTranslation` + inline German default); ≥1 `.dom.test.tsx`.
- Test files: ESM `import` only, no `require()` (AP-005).

## Out Of Scope

- Graph-Analytik (Zentralität, kürzeste Pfade, Community-Detection).
- Editieren von Relations/Mentions aus dem Graphen (nur lesen + navigieren).
- 3D-Freiflug — die 3D-Engine wird bewusst 2D genutzt (D2).
- Der exakte 1:1-Nachbau eines bestimmten Referenzbildes — Look-Familie (Glow/Galaxy/Ring) ja, Pixel-Kopie nein.

## Sources

- **Design-Referenzen (im Repo, `_design/`):**
  - Galaxy-Modus → [`_design/knowledgegraph-galaxy-view.png`](../../_design/knowledgegraph-galaxy-view.png) (Cluster-„Sonnensysteme" je Typ, Glow).
  - Ring-Modus → [`_design/knowledgegraph-ring-view.png`](../../_design/knowledgegraph-ring-view.png) (geordnete Segmente je Typ um eine Mitte).
  - Detail/Zoom → [`_design/knowledgegraph-layer-view.png`](../../_design/knowledgegraph-layer-view.png) (Hover-Kanten, Fokus auf einen Knoten).
- Engine: `react-force-graph` (vasturiano, MIT), three.js (MIT). Verifiziert: Lizenz MIT, WebGL, Bloom via `postProcessingComposer`, `nodeThreeObject` Custom-Rendering.
- Vorhandener (toter) Code: `GlobalEntityGraph.tsx`, `EntityGraph.tsx`; `PropertiesForm.tsx` (`parseMentions`), `relation-service.ts`.
- Interview 2026-07-23 (Requirement Agent).
