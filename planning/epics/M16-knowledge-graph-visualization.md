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

> ⚠️ **RENDERER GEÄNDERT (2026-07-23): `react-force-graph`/three.js → `PixiJS` (2D WebGL) + `d3-force`.**
> Grund: „echtes 3D" war die falsche Prämisse. Die Anforderungen (Pseudo-3D-Kugeln, optionales Leuchten,
> Such-Ausblenden, Ego-Graph) sind allesamt **2D mit Node-Styling** — kein 3D-Freiflug, keine Kamera-Orbit,
> kein Bloom-Post-Processing nötig, und der three.js-Weg brachte GPU-Fallback-Risiko + dauerhaften
> Library-Kampf (siehe Spike-Verdict `planning/research/graph-webgl-tauri-spike.md`, #320). D1/D2/D8/D10/D11
> unten sind entsprechend aktualisiert; die renderer-**neutralen** Decisions (D3/D4/D5/D6/D7/D9) und das
> Datenmodell bleiben unverändert gültig.

- **D1 — Renderer: `PixiJS` (2D WebGL) + `d3-force` (Layout).** Beide **MIT/ISC-lizenziert → frei für
  kommerzielle Nutzung, keine Gebühren**. Pixi batcht tausende Sprites (3k–10k-Skala), `d3-force` liefert
  das Force-Layout (Positionen). Kein „echtes 3D": kein three.js, keine Kamera-Orbit. Preis: Pan/Zoom,
  Hit-Testing, Kanten-Rendering und die Ego/Such-Sichtbarkeit bauen wir selbst (Fleißarbeit, kein
  Forschungsrisiko; Referenz: Graphifys D3-`graph.html` bzw. offener Obsidian-Graph-Klon). Neue Deps:
  `pixi.js`, `d3-force` (+ ggf. `pixi-filters` für den Glow). **`react-force-graph-3d`/`three` entfallen.**
- **D2 — 2D-Render + Pseudo-3D-Kugeln + Per-Node-Glow (kein Bloom).** Der „3D-Effekt" der Knoten ist ein
  **Radial-Gradient/vorgebackenes Kugel-Sprite** (Lichtpunkt oben-links = glänzende Kugel), **kein** echtes
  3D. Das Leuchten ist ein **Halo pro Node** (weiches Sprite dahinter, additiv / `pixi-filters` GlowFilter),
  pro Node an-/ausschaltbar — **nicht** Full-Screen-Bloom (teuer, GPU-Risiko; der Spike hat das bestätigt:
  Per-Node-Halo schlägt Bloom). Kanten-Unterscheidung visuell frei (Stärke/Deckkraft, D5), nicht gestrichelt.
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
  `d3-force`-Simulation **vorberechnen/stoppen** (`alphaTarget`→0, nicht jede Frame live simulieren),
  Sprite-Batching nutzen; **Default-View gefiltert/Ego**, damit selten alle Nodes+Kanten gleichzeitig
  gerendert werden (Kanten sind Pixis Schwachpunkt → gebündeltes Kanten-Rendering, nicht Linie-für-Linie).
  ⚠️ **Perf noch offen:** der Spike lief nur auf einem Software-Renderer (GPU-lose VM) → **Re-Run auf echter
  GPU** vor jeder Perf-Zusage.
- **D11 — Ein Renderer für BEIDE Graphen.** Der globale Graph (S03) **und** der Ego-Graph (S07) laufen auf
  `PixiJS` + `d3-force` → einheitlicher Look. Danach **Cytoscape vollständig entfernt** (`cytoscape` +
  `@types/cytoscape` aus package.json, beide alten Komponenten gelöscht).

## Datenmodell (gepinnt für S02)

Die Force-Sim (`d3-force`) und der Pixi-Renderer teilen sich `{ nodes, links }` (renderer-neutral):
```
GraphNode = { id: string; type: string; label: string; degree: number }
GraphLink = { source: string; target: string; kind: 'relation' | 'mention' }
GraphModel = { nodes: GraphNode[]; links: GraphLink[] }
```

## Stories

| Story | Issue | Kern (ein Verhalten) | hängt an |
|---|---|---|---|
| M16-S00 | #320 | ~~Spike react-force-graph-3d~~ **GELÖST/CLOSED:** Verdict = PixiJS+d3-force (2D), nicht react-force-graph-3d. Perf-Zahlen ungültig (Software-Renderer) → GPU-Re-Run offen | — |
| M16-S01 | #288 | Mention-Kanten-Extraktion (`buildMentionEdges`, reine Fn) — unverändert | — |
| M16-S02 | #317 | Graph-Datenmodell `buildGraphModel` → `{nodes, links}` (Typ+degree, Relation/Mention, D9-Subsumption) | S01 |
| M16-S03 | #324 | **Globaler Graph auf PixiJS + d3-force** + eigener Menüpunkt: Node/Link-Styling (D5/D6) + Per-Node-Glow (D2) + Klick/Hover + LOD-Config (D10) — *(#289 verworfen, war react-force-graph)* | S02 |
| M16-S04 | #318 | **Galaxy-Modus:** Cluster-nach-Typ-Kraft in der eingebauten Force-Sim | S03 |
| M16-S05 | #290 | **Ring-Modus:** deterministische Radial-Positionen, in der Engine fixiert (fx/fy) | S03 |
| M16-S06 | #319 | Controls: Switcher Galaxy⇄Ring (Ring=Default) + Verlinkungen-Toggle + Legende | S04+S05 |
| M16-S07 | #321 | **Ego-Graph auf PixiJS + d3-force** + in Entity-Detailseite verdrahten; **Cytoscape komplett raus** | S03 (#324) |

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
- Renderer: **PixiJS** (2D WebGL, MIT) + **d3-force** (Layout, ISC) — beide frei kommerziell. Referenz-Rezept: Obsidian-Graph (Pixi+d3-force) und Graphifys D3-`graph.html`. Spike-Verdict: `planning/research/graph-webgl-tauri-spike.md`. *(Zuvor react-force-graph-3d/three.js — verworfen 2026-07-23, siehe D1.)*
- Vorhandener (toter) Code: `GlobalEntityGraph.tsx`, `EntityGraph.tsx`; `PropertiesForm.tsx` (`parseMentions`), `relation-service.ts`.
- Interview 2026-07-23 (Requirement Agent).
