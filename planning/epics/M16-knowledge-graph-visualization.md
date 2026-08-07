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

> ✅ **RENDERER ENTSCHIEDEN (2026-08-07, Spike #326): `three.js` (raw) + `d3-force-3d`.** Der offene Bench
> (three.js vs Pixi vs Sigma, gleicher Graph + gleiches 3D-Layout, rotierbare Galaxy in allen drei) ergab
> three.js **mit Abstand** am besten: **echtes GPU-3D** statt CPU-Reprojektion pro Frame (der Flaschenhals,
> an dem Pixi/Sigma hingen), nativer Bloom + Tiefe/Parallax umsonst. **Bau roh** (InstancedMesh + eigene
> Passes + `d3-force-3d` im Worker), **NICHT `react-force-graph-3d`** (Kapsule-Dauer-Workarounds aus #320).
> Referenz-Rezept: `src/spikes/graph-bench/adapters/threeAdapter.ts`. Verdikt: Teil 2 in
> `planning/research/graph-webgl-tauri-spike.md`. **D1/D2 (+ D6/D7/D10/D11/D12) unten sind auf three.js
> umgeschrieben**; die renderer-neutralen Decisions (D3/D4/D5/D9, Datenmodell) bleiben unveraendert gueltig.
>
> *(Historie: #320 war auf `react-force-graph-3d` verengt + lief auf GPU-loser VM → schwenkte vorschnell auf
> „2D-Pixi" (provisorisch). #326 vermaß den Optionsraum offen und bestaetigte echtes 3D via three.js.
> Ausgeschlossen blieben `cosmos.gl` + alle bezahlten/nicht-kommerziellen. Volle Landschaft:
> `planning/research/graph-view-landscape-2026-08.md`.)*

- **D1 — Renderer: `three.js` (raw, WebGL) + `d3-force-3d` (3D-Layout im Web Worker).** Beide **MIT/ISC →
  frei kommerziell**. Knoten als **InstancedMesh** (per-instance Farbe+Scale → wenige Draw-Calls bei 3k–10k),
  Kanten als **zwei `LineSegments`** (relation/mention). Rotate/Pan/Zoom via `OrbitControls` (Kamera kommt
  mit). **Raw, NICHT `react-force-graph-3d`** — die Kapsule-Lib erzwingt Dauer-Workarounds (verzoegerter
  Prop-Digest, re-parentet Lichter, baut Nodes neu; belegt in #320). `d3-force-3d` rechnet die 3D-Positionen
  im Worker (blockiert UI nie). Deps: **`three`, `d3-force-3d`** (beide bereits vorhanden). **Entfallen:
  `react-force-graph-3d`; `pixi.js` + `d3-force` werden entfernbar, sobald der (tote, nie gemountete)
  Pixi-`GraphCanvas`-Stand durch den three.js-Core ersetzt ist.**
- **D2 — Echtes 3D: beleuchtete Kugeln + optionaler Bloom.** Der 3D-Effekt der Knoten ist eine **echte
  beleuchtete Kugel** (InstancedMesh `SphereGeometry` + `MeshLambertMaterial` + Kamera-Headlight), **kein**
  Sprite-Fake, **kein** flacher Kreis. Das Leuchten ist **nativer `UnrealBloomPass`** (mit sRGB-Decode-Fix
  gegen den Grauschleier, siehe Verdikt-Doc Teil 1), schaltbar, **Default-AUS**; billige Alternative = additiver
  Glow-Sprite pro Node. **Der Look ist bereits gebaut und wird PORTIERT, nicht neu erfunden**:
  `src/spikes/GraphWebglSpike.tsx` (getunt: Pastell-Palette, Groessen-Spread `(1+spread)^(degreeNorm−0.5)`,
  Headlight) + `src/spikes/graph-bench/adapters/threeAdapter.ts` (Instancing, LineSegments, Decode→Bloom→
  OutputPass-Kette). Kanten-Unterscheidung visuell (Staerke/Deckkraft, D5), nicht gestrichelt.
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
- **D6 — Knoten-Kodierung.** InstancedMesh-Kugel, Farbe = `typeColor(type)`, **Größe nach `degree`**,
  Radius deterministisch geklemmt (feste Min/Max in Weltkoordinaten → test-/baubar). Bloom/Glow optional (D2).
- **D7 — Interaktion (im Renderer-Core).** Klick auf Knoten → `onNavigate(entityId)` (Raycast auf die
  InstancedMesh-Instanz). Hover → Knoten + inzidente Kanten + Nachbarn hervorheben, Rest dimmen.
  **Rotate/Pan/Zoom via `OrbitControls`** (three.js bringt die Kamera mit — kein Eigenbau, anders als beim
  verworfenen Pixi-Pfad).
- **D8 — Layout vom Renderer entkoppelt.** Galaxy = Force-Sim-Konfiguration (Cluster-Kraft). Ring = deterministische
  Positionen, in der Engine **fixiert** (`fx`/`fy`, Force aus). So bleibt jede Story isoliert test-/baubar.
- **D9 — Relation subsumiert Mention.** Existiert zwischen zwei Knoten eine `relation`, wird eine `mention`
  desselben (ungeordneten) Paars verworfen — keine doppelte Linie.
- **D10 — LOD/Performance ist reale Anforderung (3k–10k Nodes).** Label-Culling beim Rauszoomen (Labels erst nah),
  `d3-force-3d` **vorberechnen/stoppen** (Worker, `alpha`→0, nicht jede Frame live simulieren), **InstancedMesh**
  fuer Nodes + gebuendelte `LineSegments` fuer Kanten (three.js zeichnet 10k Nodes in wenigen Draw-Calls — genau
  der GPU-Vorteil gegen die CPU-Reprojektion, an der Pixi/Sigma im Bench scheiterten); **Default-View
  gefiltert/Ego**, damit selten alle Nodes+Kanten gleichzeitig gerendert werden.
  ⚠️ **Renderer-Wahl steht (three.js, #326);** exakte 10k-fps auf starker GPU noch nachzumessen (diese Maschine
  fuhr 3k fluessig, 10k nicht simulierbar) — das kippt die Wahl aber nicht mehr.
  - **Layout im Web Worker.** `d3-force-3d` rechnet die 3D-Positionen in einem **Worker** (Positionen per
    Message an den Renderer), damit die Sim den UI-Thread nie blockiert. Im Bench
    (`src/spikes/graph-bench/layoutWorker.ts`) bereits so gebaut = Referenz.
- **D11 — Ein Renderer für BEIDE Graphen.** Der globale Graph (S03) **und** der Ego-Graph (S07) laufen auf
  `three.js` + `d3-force-3d` → einheitlicher Look. Danach **Cytoscape vollständig entfernt** (`cytoscape` +
  `@types/cytoscape` aus package.json, beide alten Komponenten gelöscht).
- **D12 — EIN Visualisierungs-Element für ALLE Ansichten (gegen Drift, harte Vorgabe).** Es gibt **genau eine**
  Komponente, die die Visualisierung hält — `GraphCanvas` (Arbeitsname), gebaut in S03 (#324). Sie nimmt
  `{ nodes, links }` + Styling-Accessoren (`nodeStyle`/`edgeStyle`) + Layout-Config + Callbacks
  (`onNavigate`, Hover) und zeichnet Nodes/Kanten (three.js-Szene) + Kamera (`OrbitControls`) + Raycast-
  Hit-Test — **ohne** eigenes Graph-Wissen (kein „global vs. ego" im Element, keine Force-Konfig fest verdrahtet).
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
| **M16-S00b** | **#326** | **OFFENER Renderer-Spike** (three.js vs Pixi vs Sigma, rotierbare 3D-Galaxy, gleiches Layout) — **✅ ENTSCHIEDEN: three.js raw** (mit Abstand bester; D1/D2 fixiert). Bench-Code `src/spikes/graph-bench/` | — |
| M16-S01 | #288 | Mention-Kanten-Extraktion (`buildMentionEdges`, reine Fn) — **✅ fertig** (Fn + Test existieren) | — |
| M16-S02 | #317 | Graph-Datenmodell `buildGraphModel` → `{nodes, links}` (Typ+degree, Relation/Mention, D9-Subsumption) | S01 |
| M16-S03 | #324 | **Globaler Graph auf three.js (raw, D1)** + eigener Menüpunkt + **geteilter `GraphCanvas`-Core (D12)**: Styling (D5/D6) + Bloom/Glow Default-AUS (D2) + Klick/Hover + LOD (D10) | S02, **S00b** |
| M16-S04 | #318 | **Galaxy-Modus:** Cluster-nach-Typ-Kraft in der `d3-force-3d`-Sim (three.js) | S03 |
| M16-S05 | #290 | **Ring-Modus** ⚠️ `needs-design`: soll in **„Areas" unterteilt** werden (nicht bloße 2D-Typ-Projektion) — aktueller Body ist Platzhalter, Neu-Interview offen | S03 |
| M16-S06 | #319 | Controls: Switcher Galaxy⇄Ring + Verlinkungen-Toggle + **Glow-Schalter** + Legende + **Start-Default-Wahl** | S04+S05 |
| M16-S07 | #321 | **Ego-Graph auf `GraphCanvas`-Core** + in Entity-Detail verdrahten (voller Umfang: Tiefe 1/2/3 + Relations-Typ-Filter + inaktiv; BFS über relations+mentions); **Cytoscape komplett raus** — **bewusst zuletzt (`p2`)** | S03 (#324) |
| M16-S09 | _(kein Issue)_ | **Community-Färbung** ⚠️ `needs-decision` (D14) — geparkt bis entschieden (ersetzt/ergänzt Typ-Farbe?) | S02 |
| M16-S10 | #327 | **Vorberechnete + gecachte Layout-Positionen** (headless `d3-force-3d` im Worker, Struktur-Hash-Cache, Sofort-Render) (D15) — `p1` | S02 |
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
- Der exakte 1:1-Nachbau eines bestimmten Referenzbildes — Look-Familie (Glow/Galaxy/Ring) ja, Pixel-Kopie nein.

## Sources

- **Design-Referenzen (im Repo, `_design/`):**
  - Galaxy-Modus → [`_design/knowledgegraph-galaxy-view.png`](../../_design/knowledgegraph-galaxy-view.png) (Cluster-„Sonnensysteme" je Typ, Glow).
  - Ring-Modus → [`_design/knowledgegraph-ring-view.png`](../../_design/knowledgegraph-ring-view.png) (geordnete Segmente je Typ um eine Mitte).
  - Detail/Zoom → [`_design/knowledgegraph-layer-view.png`](../../_design/knowledgegraph-layer-view.png) (Hover-Kanten, Fokus auf einen Knoten).
- Renderer: **three.js** (raw, WebGL, MIT) + **d3-force-3d** (3D-Layout, ISC) — beide frei kommerziell. Entschieden im offenen Bench #326 (Teil 2 in `planning/research/graph-webgl-tauri-spike.md`); Referenz-Rezept `src/spikes/graph-bench/adapters/threeAdapter.ts` + `src/spikes/GraphWebglSpike.tsx`. *(Zwischenstand 2026-07-23 „2D-Pixi" war provisorisch — von #326 abgeloest. `react-force-graph-3d` bewusst NICHT (Kapsule-Workarounds).)*
- **Landschaft der Vergleichs-Repos (verifiziert 2026-08 aus deren Code):** `claude-obsidian` baut **keinen** Renderer (Python; Screenshot = Obsidians nativer Graph = **Pixi/WebGL 2D**). `StellarGraph` = Obsidian-Plugin, **handgerolltes Canvas-2D + manuelle 3D-Projektion**, 0 Libs (skaliert nur auf Hunderte Nodes). `Graphify` (YC S26, Python) = **`vis-network@9.1.6`** (Canvas-2D + eingebaute Physik). → **Keiner nutzt echtes three.js-3D; der einzige, der auf 10k skaliert, ist Obsidian = unser Stack.**
- Vorhandener (toter) Code: `GlobalEntityGraph.tsx`, `EntityGraph.tsx`; `PropertiesForm.tsx` (`parseMentions`), `relation-service.ts`.
- Interview 2026-07-23 (Requirement Agent).
