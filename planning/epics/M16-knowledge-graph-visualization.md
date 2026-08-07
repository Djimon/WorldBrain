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

> 🔴 **RENDERER-ENTSCHEIDUNG WIEDER OFFEN (2026-08).** Die 2D-Pixi-Festlegung unten ist **provisorisch**, nicht
> gesichert. Grund: die Spike-Spec (#320) war auf **eine einzige vorgewählte Lösung** verengt („validiere
> `react-force-graph-3d` + Bloom") statt den Optionsraum zu erkunden — der Spike selbst war ok, seine **Spec**
> war der Fehler. Als die eine Lösung (auf **GPU-loser VM**, also kaputten Bedingungen) zickte, wurde vorschnell
> auf die nächste einzelne Antwort (2D-Pixi) umgeschwenkt und als Fakt zementiert. **Gegenbeleg:** ausgereifte
> echte-3D-Graphen laufen in WebViews (`3d-force-graph`/three.js = obsidian-3d-graph; Dutzende MIT-Forks). **Nächster
> Schritt: ein OFFENER Spike (#326, ersetzt #320).** Kandidaten (erkunden, nicht vorpicken; **nur frei-kommerziell**):
> **`3d-force-graph`/three.js** (echtes 3D, MIT — Zielbild), **Pixi v8 + d3-force** (Inkumbent), optional **Sigma.js**.
> **Ausgeschlossen (User): `cosmos.gl` und alle bezahlten/nicht-kommerziellen** (Cosmograph CC-BY-NC, Ogma, yFiles,
> Graphistry). Frei zu verwerfen + neu zu recherchieren; gemessen bei **3k–10k auf echter GPU UND schwachem/VM-Ziel**
> (inkl. WebGL-Fail: WebView2 v144+ hat den SwiftShader-Fallback entfernt → GPU-Detektion Pflicht). Erst dessen
> Ergebnis fixiert D1/D2. **Volle verifizierte Landschaft: `planning/research/graph-view-landscape-2026-08.md`**
> (4-Agenten-Deep-Research 2026-08). Bis dahin sind alle renderer-spezifischen Entscheidungen
> (D1, D2, teils D6/D7/D10/D11/D12) **unter Vorbehalt**; die renderer-**neutralen** (Datenmodell, D3/D4/D5/D9)
> bleiben gültig.

> ⚠️ **(überholt, 2026-07-23) RENDERER GEÄNDERT: `react-force-graph`/three.js → `PixiJS` (2D WebGL) + `d3-force`.**
> Grund: „echtes 3D" war die falsche Prämisse. Die Anforderungen (Pseudo-3D-Kugeln, optionales Leuchten,
> Such-Ausblenden, Ego-Graph) sind allesamt **2D mit Node-Styling** — kein 3D-Freiflug, keine Kamera-Orbit,
> kein Bloom-Post-Processing nötig, und der three.js-Weg brachte GPU-Fallback-Risiko + dauerhaften
> Library-Kampf (siehe Spike-Verdict `planning/research/graph-webgl-tauri-spike.md`, #320). D1/D2/D8/D10/D11
> unten sind entsprechend aktualisiert; die renderer-**neutralen** Decisions (D3/D4/D5/D6/D7/D9) und das
> Datenmodell bleiben unverändert gültig.

- **D1 — Renderer: `PixiJS` v8 (2D WebGL) + `d3-force` v3 (Layout).** Beide **MIT/ISC-lizenziert → frei für
  kommerzielle Nutzung, keine Gebühren**. Pixi batcht tausende Sprites (3k–10k-Skala), `d3-force` liefert
  das Force-Layout (Positionen). **Pixi im WebGL-Modus, nicht WebGPU** (verschärft den Software-Fallback nicht).
  Kein „echtes 3D": kein three.js, keine Kamera-Orbit. Preis: Pan/Zoom, Hit-Testing, Kanten-Rendering und
  die Ego/Such-Sichtbarkeit bauen wir selbst (Fleißarbeit, kein Forschungsrisiko; Referenz-Rezept:
  Obsidian-Graph = Pixi+d3-force, unser Vorbild für Look **und** Skala). Neue Deps: **`pixi.js` (v8), `d3-force` (v3)** —
  `pixi-filters` **nicht** nötig (Halo = Sprite, Default-AUS). **`react-force-graph-3d`/`three` entfallen.**
- **D2 — 2D-Render + Pseudo-3D-Kugeln + Per-Node-Glow (kein Bloom).** Der „3D-Effekt" der Knoten ist ein
  **Radial-Gradient-Sprite** (Lichtpunkt oben-links = glänzende Kugel), **kein** echtes 3D, **NICHT** ein
  flacher `circle().fill()`. Das Leuchten ist ein **Halo pro Node** (weiches Sprite dahinter, additiv),
  pro Node an-/ausschaltbar — **nicht** Full-Screen-Bloom. **Der Look ist im Spike
  `src/spikes/GraphWebglSpike.tsx` bereits getunt und wird PORTIERT, nicht neu erfunden** (renderer-neutrale
  Canvas-/Gradient-Technik): `getGlowTexture()` (Halo), die Pastell-Palette, der Größen-Spread
  `(1+spread)^(degreeNorm−0.5)`. Der Spike ist die **Referenz = Anforderung**, kein optionales Vorbild.
  Kanten-Unterscheidung visuell frei (Stärke/Deckkraft, D5), nicht gestrichelt.
- **D3 — Gruppierung nach Entity-Typ.** Galaxy-Cluster + Ring-Segmente nach `type`; Knotenfarbe = Typ-Farbe
  über **einen** `typeColor(type): number`-Resolver (siehe D6). ⚠️ Korrektur: `src/blocks/entity-type-colors.ts`
  (`ENTITY_TYPE_COLORS`) enthält nur **Token-Namen** (`'purple'`…), **hat keine Hex-Auflösung und wird nirgends
  konsumiert** — es gibt also kein fertiges „EPIC-003-Mapping". `typeColor` seedet aus diesen Token-Namen eine
  kanonische Token→Hex-Tabelle; unbekannter Typ (z.B. `Lore`, Plugin-Typen) → **deterministischer** Hash-Fallback.
- **D4 — Zwei Layout-Modi, umschaltbar; Galaxy = Start-Default.** Galaxy (Cluster-Galaxie) ist die
  Start-Ansicht — das „Kernelement" soll beim Öffnen sofort sichtbar sein. Ring per Switcher (S06) erreichbar.
  *(Kehrt die frühere „Ring=Default"-Festlegung um — bewusste Entscheidung 2026-08.)*
  ⚠️ **Ring (S05) wird neu konzipiert:** soll in **„Areas" unterteilt** werden (thematische Bereiche), **nicht**
  bloß eine 2D-Radial-Projektion je Typ. Bis dahin ist S05/#290 `needs-design`, nicht final.
- **D5 — Kanten-Kodierung.** `relation` = **dick** (~2.5px), durchgezogen, deckend. `mention` = **dünn** (~1px),
  gedämpfte Farbe, halbtransparent (~0.35). Verlinkungen sind den Relations visuell untergeordnet.
- **D6 — Knoten-Kodierung.** Pseudo-3D-Kugel-Sprite, Farbe = `typeColor(type)`, **Größe nach `degree`**,
  Radius geklemmt auf **[6px … 22px]** (feste Zahlen → deterministisch test-/baubar). Halo optional (D2).
- **D7 — Interaktion (selbst verdrahtet, im Renderer-Core).** Klick auf Knoten → `onNavigate(entityId)`.
  Hover → Knoten + inzidente Kanten + Nachbarn hervorheben, Rest dimmen. Pan/Zoom via Pixi-Pointer-Events
  (Pixi hat **keine** fertige „Kamera" wie three.js — Pan/Zoom/Hit-Testing bauen wir, siehe D1).
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
  - **Force-Sim im Web Worker (belegter Obsidian-Ansatz).** Obsidians Hochleistungs-Graph (Pixi v8 + d3-force,
    10k@50fps) rechnet die Physik in einem **Web Worker**, der UI-Thread rendert nur. → `d3-force` in einen
    Worker auslagern (Positionen per Message zurück an `GraphCanvas`), damit die Sim das UI nie blockiert.
    Ziel-Referenz für „schafft 10k?". Quelle: Obsidian Advanced Graph View (Pixi v8 + d3-force im Worker).
- **D11 — Ein Renderer für BEIDE Graphen.** Der globale Graph (S03) **und** der Ego-Graph (S07) laufen auf
  `PixiJS` + `d3-force` → einheitlicher Look. Danach **Cytoscape vollständig entfernt** (`cytoscape` +
  `@types/cytoscape` aus package.json, beide alten Komponenten gelöscht).
- **D12 — EIN Visualisierungs-Element für ALLE Ansichten (gegen Drift, harte Vorgabe).** Es gibt **genau eine**
  Komponente, die die Visualisierung hält — `GraphCanvas` (Arbeitsname), gebaut in S03 (#324). Sie nimmt
  `{ nodes, links }` + Styling-Accessoren (`nodeStyle`/`edgeStyle`) + Layout-Config + Callbacks
  (`onNavigate`, Hover) und zeichnet Nodes/Kanten/Pan/Zoom/Hit-Test — **ohne** eigenes Graph-Wissen (kein
  „global vs. ego" im Element, keine Force-Konfig fest verdrahtet).
  **Der Aufrufer entscheidet allein über die mitgegebenen Daten/Filter, WAS gerendert wird:**
  - **Global/Galaxy (S03/S04):** übergibt das **komplette** Modell (alle Nodes + Kanten).
  - **Ego (S07):** übergibt **nur** `{ Fokus-Entity + N Nachbarn }` (BFS-Subgraph).
  - **Ring/Galaxy (S05/S04):** unterscheiden sich nur in der **Layout-Config**-Prop, nicht im Element.
  **Verboten:** eine zweite Renderer-/Ego-Komponente, ein geforkter Draw-Pfad, dupliziertes Node/Kanten-Zeichnen.
  Das ist der konkrete Mechanismus hinter D11.
- **D13 — Menü-/Mount-Anker (verifiziert im Code).** Globaler Graph = neuer `Area` in `src/ui/WorkspaceShell.tsx`
  (`type Area`-Union + `AREAS`-Liste + `case 'graph':`, Label via `t(id)` aus nav-Ressource). Ego-Graph =
  neuer `registerEntityTab({ id:'graph', … })` in `src/tab-wiring.tsx` (der alte `EntityGraph.tsx` ruft das
  **nie** auf → Dead-Wiring-Ursache). `TabDefinition.render` liefert `{ entityId, database, onNavigate }`.

### Datenmodell-Upgrade (2026-08, User-Entscheidung: in M16 aufnehmen — renderer-unabhängig)

Aus dem Deep-Research (`planning/research/graph-view-landscape-2026-08.md`): der **eigentliche Differenzierer ist
das Datenmodell, nicht der Renderer**. LLM-Graph-Tools konvergieren auf SPO-Tripel + Provenienz + Community-Färbung
+ vorberechnete Positionen. **An unsere Realität angepasst** (unsere Kanten sind **user-authored**, nicht
LLM-extrahiert — daher NICHT alles 1:1 übernehmen):

- **D14 — Community-Detection → Färbung/Cluster (⚠️ `needs-decision`, GEPARKT).** Idee: Leiden/Louvain
  (z.B. `graphology-communities-louvain`, MIT) → `community`-Id je Node, als **alternative Färbung** neben Typ-Farbe.
  **Noch nicht committed** (User: „needs-decision") — offene Frage u.a.: ersetzt oder ergänzt sie die Typ-Farbe (D3)?
  Kein Issue, bis entschieden. Der Spike (#326) kann die Färbung optional testweise zeigen, falls Daten vorliegen.
- **D15 — Vorberechnete + gecachte Layout-Positionen (IN Scope, S10/#327).** Force-Layout **einmal** headless
  (Worker) rechnen, Positionen je Node über Struktur-Hash cachen → Client rendert **sofort** ohne Kalt-Physik
  (großer UX/Perf-Win bei 10k, renderer-unabhängig). Recompute bei Datenänderung. Ergänzt D10.
- **Provenienz — schon vorhanden, NICHT neu erfinden.** Unser `kind: 'relation' | 'mention'` **ist** die
  Provenienz/Quelle (explizit-typisiert vs. @-abgeleitet, D5). **Kein** `confidence`-Feld jetzt: unsere Relations
  sind user-authored, ein Confidence-Wert wäre spekulativ (siehe „keine speculative Felder"). Reserviert für später,
  falls je LLM-**inferred** Kanten dazukommen — dann erst `origin: 'user' | 'inferred'` + `confidence`.

## Datenmodell (gepinnt für S02)

Die Force-Sim (`d3-force`) und der Renderer teilen sich `{ nodes, links }` (renderer-neutral):
```
GraphNode = { id: string; type: string; label: string; degree: number; community?: number }
GraphLink = { source: string; target: string; kind: 'relation' | 'mention'; relation_type?: string }
GraphModel = { nodes: GraphNode[]; links: GraphLink[] }
```
- `relation_type?` — gesetzt für `kind:'relation'` (aus `getAllRelations`), ermöglicht **Kantenfarbe nach Relation-Typ** (D5-Erweiterung; im Spike #326 als Regler). `mention`-Kanten haben keinen. **S02 (#317) muss es mitliefern.**
- `community?` — aus D14 (Louvain, S09), optionale Community-Färbung. Von S02 optional, sonst per S09-Pass ergänzt.

## Stories

| Story | Issue | Kern (ein Verhalten) | hängt an |
|---|---|---|---|
| M16-S00 | #320 | ~~Spike react-force-graph-3d~~ **GELÖST/CLOSED** (Spec zu eng, VM-Bedingungen) → ersetzt durch #326 | — |
| **M16-S00b** | **#326** | **OFFENER Renderer-Spike** (`3d-force-graph` vs Pixi+d3 vs Sigma; kein cosmos/paid) bei 10k auf echter GPU + schwachem Ziel, inkl. WebGL-Fail. Fixiert D1/D2 (`p0`) | — |
| M16-S01 | #288 | Mention-Kanten-Extraktion (`buildMentionEdges`, reine Fn) — **✅ fertig** (Fn + Test existieren) | — |
| M16-S02 | #317 | Graph-Datenmodell `buildGraphModel` → `{nodes, links}` (Typ+degree, Relation/Mention, D9-Subsumption) | S01 |
| M16-S03 | #324 | **Globaler Graph auf dem #326-Renderer** + eigener Menüpunkt + **geteilter `GraphCanvas`-Core (D12)**: Styling (D5/D6) + Glow Default-AUS (D2) + Klick/Hover + LOD (D10) | S02, **S00b** |
| M16-S04 | #318 | **Galaxy-Modus:** Cluster-nach-Typ-Kraft in der Force-Sim (auf dem #326-Renderer) | S03 |
| M16-S05 | #290 | **Ring-Modus** ⚠️ `needs-design`: soll in **„Areas" unterteilt** werden (nicht bloße 2D-Typ-Projektion) — aktueller Body ist Platzhalter, Neu-Interview offen | S03 |
| M16-S06 | #319 | Controls: Switcher Galaxy⇄Ring + Verlinkungen-Toggle + **Glow-Schalter** + Legende + **Start-Default-Wahl** | S04+S05 |
| M16-S07 | #321 | **Ego-Graph auf `GraphCanvas`-Core** + in Entity-Detail verdrahten (voller Umfang: Tiefe 1/2/3 + Relations-Typ-Filter + inaktiv; BFS über relations+mentions); **Cytoscape komplett raus** — **bewusst zuletzt (`p2`)** | S03 (#324) |
| M16-S09 | _(kein Issue)_ | **Community-Färbung** ⚠️ `needs-decision` (D14) — geparkt bis entschieden (ersetzt/ergänzt Typ-Farbe?) | S02 |
| M16-S10 | #327 | **Vorberechnete + gecachte Layout-Positionen** (headless d3-force im Worker, Struktur-Hash-Cache, Sofort-Render) (D15) — `p1` | S02 (2D/3D folgt S00b) |
| M16-S08 | _(offen)_ | Software-WebGL erkennen (`WEBGL_debug_renderer_info`) + dezente Warnung (Spike-Risiko). Aus S03 herausgehalten. | S03 |

**Bau-Reihenfolge (rekursiv nach blocked-by aufgelöst; Ziel: Galaxy-Kernelement so früh wie möglich sichtbar, Ego zuletzt):**

**`S00b (#326, OFFENER Spike) = Renderer entschieden`** + `S01 (#288, ✅ fertig)` → `S02 (#317)` → `S03 (#324) = Element steht, globaler Graph erstmals sichtbar` → **`S04 (#318) = Galaxy-Graph steht ◀ Kernelement sichtbar`** → `S05 (#290, Ring)` → `S06 (#319, Controls/Default)` → `S07 (#321, Ego — zuletzt)`.

- **S00b (Spike) ist die Wurzel:** er fixiert D1/D2 (welcher Renderer), MUSS vor S03 stehen. S01+S02 (renderer-neutrale Daten) laufen parallel dazu.
- **Kürzester Pfad zum sichtbaren Galaxy:** S00b → S02 → S03 → S04.
- **Datenmodell-Stories (S09 Community-Färbung, S10 vorberechnete Positionen)** hängen an S02, renderer-unabhängig → jederzeit parallel nach S02 baubar; S10 profitiert vom Spike-Renderer (S00b).
- **Ego (S07) hängt nur an S03**, wäre früh baubar — steht aber **per Wunsch ans Ende** (`p2`).
- **S08** (Software-WebGL-Warnung) optional, jederzeit nach S03.

## Constraints (verbatim in jede betroffene Story-AC)

- AP-001: `database` prop typed as `DatabaseLike` (from `entity-service.ts`); no `unknown`/`as never`.
- AP-006: No `try/catch` around DB operations; errors propagate. (Ausnahme: `JSON.parse`/Mention-Parse → safe fallback.)
- AP-008 (service gate): No `if (database)`/`if (service)` guard before service calls.
- UI-Stories (S03/S06/S07): AP-003 (no `prompt`/`alert`/`confirm`); AP-008 RTL (anchored queries); keine hardcodierten UI-Strings (`useTranslation` + inline German default); ≥1 `.dom.test.tsx`.
- Test files: ESM `import` only, no `require()` (AP-005).

## Out Of Scope

- Graph-Analytik: **Community-Detection = `needs-decision`** (D14/S09, geparkt — nicht bestätigt in-scope). Weiterhin **out**: Zentralitäts-Maße (Betweenness etc.), kürzeste Pfade — später, falls überhaupt.
- Editieren von Relations/Mentions aus dem Graphen (nur lesen + navigieren).
- 3D-Freiflug — die 3D-Engine wird bewusst 2D genutzt (D2).
- Der exakte 1:1-Nachbau eines bestimmten Referenzbildes — Look-Familie (Glow/Galaxy/Ring) ja, Pixel-Kopie nein.

## Sources

- **Design-Referenzen (im Repo, `_design/`):**
  - Galaxy-Modus → [`_design/knowledgegraph-galaxy-view.png`](../../_design/knowledgegraph-galaxy-view.png) (Cluster-„Sonnensysteme" je Typ, Glow).
  - Ring-Modus → [`_design/knowledgegraph-ring-view.png`](../../_design/knowledgegraph-ring-view.png) (geordnete Segmente je Typ um eine Mitte).
  - Detail/Zoom → [`_design/knowledgegraph-layer-view.png`](../../_design/knowledgegraph-layer-view.png) (Hover-Kanten, Fokus auf einen Knoten).
- Renderer: **PixiJS** (2D WebGL, MIT) + **d3-force** (Layout, ISC) — beide frei kommerziell. Referenz-Rezept: Obsidian-Graph (Pixi+d3-force). Spike-Verdict: `planning/research/graph-webgl-tauri-spike.md`. *(Zuvor react-force-graph-3d/three.js — verworfen 2026-07-23, siehe D1.)*
- **Landschaft der Vergleichs-Repos (verifiziert 2026-08 aus deren Code):** `claude-obsidian` baut **keinen** Renderer (Python; Screenshot = Obsidians nativer Graph = **Pixi/WebGL 2D**). `StellarGraph` = Obsidian-Plugin, **handgerolltes Canvas-2D + manuelle 3D-Projektion**, 0 Libs (skaliert nur auf Hunderte Nodes). `Graphify` (YC S26, Python) = **`vis-network@9.1.6`** (Canvas-2D + eingebaute Physik). → **Keiner nutzt echtes three.js-3D; der einzige, der auf 10k skaliert, ist Obsidian = unser Stack.**
- Vorhandener (toter) Code: `GlobalEntityGraph.tsx`, `EntityGraph.tsx`; `PropertiesForm.tsx` (`parseMentions`), `relation-service.ts`.
- Interview 2026-07-23 (Requirement Agent).
