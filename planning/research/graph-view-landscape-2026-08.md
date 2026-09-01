# Research: Graph-View-Landschaft & Renderer-Optionen (M16) — 2026-08

**Anlass:** Der M16-Renderer-Spike (#320) war auf **eine** vorgewählte Lösung verengt (`react-force-graph-3d`) und lief auf einer **GPU-losen VM** → seine „2D statt 3D"-Schlussfolgerung ist **schwache Evidenz**, kein Fakt. Dieser Deep-Research (4 parallele Subagenten, **Tech jeweils am Repo verifiziert**) öffnet den Optionsraum neu. Siehe Lernregel `feedback_spike_spec_open_not_predefined`.

**Kern-Erkenntnis vorweg:** Ein **echter 3D-Galaxy-Graph ist heute trivial und allgegenwärtig** — Dutzende frische MIT-Repos (Juni–Aug 2026) sind dünne Wrapper um `3d-force-graph`/three.js. Meine frühere „3D war die falsche Prämisse"-Doktrin war Filterblase. Die ehrliche offene Frage ist **nicht** „geht 3D?" (ja), sondern **„welcher Renderer trägt 3k–10k Nodes in WebView2, frei-kommerziell, mit Galaxy-Look — und übersteht den WebGL-Fallback-Wegfall?"**

---

## 1. Engine-Optionsraum (frei-kommerziell zuerst)

| Engine | 2D/3D | Tech | Lizenz | Belegte Skala | Galaxy-Look / API | Aktualität |
|---|---|---|---|---|---|---|
| **cosmos.gl** (`@cosmos.gl/graph`, ex-`@cosmograph/cosmos`) | 2D | Layout **+** Render auf **GPU** (WebGL2/luma.gl) | **MIT** (OpenJS) | **1M+** Nodes | Galaxy = native Ästhetik; imperativ; **nur Punkte+Linien** (keine reichen Per-Node-Sprites) | sehr aktiv (v3) |
| **3d-force-graph / react-force-graph-3d** | **echtes 3D** | three.js/WebGL + d3-force-3d | **MIT** | ~1–3k bequem, 10k nur mit Instancing/Tuning | Bloom/Glow out-of-the-box; deklarativ + Escape-Hatch zu raw three.js | **v1.80 ~Juni 2026** |
| **PixiJS v8 + d3-force** (Inkumbent) | 2D (+ Fake-3D-Sprites) | Pixi WebGL2 render; **d3-force CPU** | **MIT** + **ISC** | Render 10k+ leicht; **CPU-Layout ist der Flaschenhals** ab ~2–5k | Voller Look-Kontroll (Glow-Filter, additiv); komplett imperativ (man wartet alles selbst) | aktiv |
| **Sigma.js (+ graphology)** | 2D | WebGL (custom shader programs) | **MIT** | 10k–100k mit Offline-Layout | Glow = eigene WebGL-Programme (mehr Aufwand als Pixi); 2D-only | aktiv (v3) |
| **deck.gl + graph-layers** | 2D | WebGL2/WebGPU (luma.gl) | **MIT** | Basis 1M Punkte; Layout = dein Problem | additiv/GPU → Galaxy möglich; steile Lernkurve | aktiv |
| **AntV G6 v5** | 2D + 3D | @antv/g: Canvas/SVG/WebGL; WASM/WebGPU-Layout | **MIT** | „Tausende locker"; wenig unabh. 10k-Benchmarks | themebar; großer Framework-Footprint | aktiv (Ant Group) |
| **Cytoscape.js** | 2D | Canvas2D (WebGL nur **Preview** seit v3.31) | MIT | Canvas ~3k; WebGL-Preview 3.2k/68k Kanten 3–10 FPS | analyse-first, Glow schwer | WebGL noch Preview → riskant für 10k |
| **vis-network** | 2D | Canvas2D | MIT/Apache | ~3–5k Praxis-Ceiling | Diagramm-Look, kein echter Glow | mature, kein WebGL-Roadmap |
| ~~Cosmograph~~ (`@cosmograph/cosmograph`) | 2D | WebGL (auf cosmos) | 🚫 **CC-BY-NC-4.0 (nicht-kommerziell)** | 1M+ | turnkey, aber **Lizenz blockt Kommerz** | — |
| ~~Ogma / yFiles / Graphistry~~ | — | WebGL | 🚫 **kommerziell/bezahlt** | groß | — | — |

⚠️ **Namens-Falle:** **`cosmos.gl` = MIT (frei)** vs. **`Cosmograph` = CC-BY-NC (bezahlt)** — gleiche Engine, gleicher Autor, andere Lizenz. Nicht verwechseln.

## 2. Das entscheidende Deployment-Risiko (betrifft JEDE WebGL-Wahl)

- **WebView2/Edge ab v144 hat den SwiftShader-Software-WebGL-Fallback entfernt** (Sicherheit, Chromium-weit). Folge: auf Maschinen ohne GPU-Beschleunigung (VMs, alte Treiber, RDP) kann die **WebGL2-Kontext-Erzeugung *hart fehlschlagen*** — nicht mehr „langsam degradieren". Tauri hat dokumentierte Fälle von software-backed WebGL2 (`tauri#4891`).
- **Konsequenz (Pflicht, egal welche Engine):** beim Start **GPU-echtes WebGL2 detektieren** (`WEBGL_debug_renderer_info`) und sonst sauber degradieren (Node-Cap / statisches Layout / Hinweis). Pure-GPU-Engines (cosmos.gl, deck.gl) sind am stärksten exponiert; Canvas-Fallback-Libs am wenigsten — die schaffen aber den 10k-Galaxy-Look ohnehin nicht.

## 3. Was die „hunderte Videos" wirklich sind

- Die frische Welle (Juni–Aug 2026) lebt **auf GitHub, nicht YouTube**: Dutzende neue **MIT-Repos**, fast alle **vibe-coded**, fast alle **`3d-force-graph` auf `three` ^0.185**. Ästhetik-Konvergenz auf „Galaxy / Star-Map / JARVIS-HUD" — Unterschied ist Chrome, nicht Renderer. Ein Claude-Code-Nutzer beschreibt seinen 3D-Graph als *„vibecoded in a couple hours"*.
- **Bester Architektur-Referenzpunkt:** **CocoRoF/graphier** — three.js + d3-force-3d im **Web Worker**, **instanced meshes (2 draw calls)**, reheat-free Filtering, explizit „10k+", MIT, als **einbettbare React-Lib**. Dreifach bestätigt (Agenten A, B, D).
- Weitere saubere MIT-Referenzen: `agentage/obsidian-galaxy` (cleaner 3d-force-graph-Baseline), `chuong1224/agents-knowledge-base` (zero-deps, vendored — gutes WebView-Bundle-Muster), `n23eos/advanced_graph_view` (**Pixi v8, dokumentiert 10k@50fps**, 2D+Fake-3D).
- **Copyleft meiden** (nicht frei-kommerziell): Juggl, Extended Graph (GPL-3.0), InfraNodus (AGPL-3.0), Prompt-Surfer/obsidian-jarvis-ui (AGPL).

## 4. Renderer ist NICHT der Differenzierer — das Datenmodell ist es

Aus der LLM-Graph-Recherche (Agent C): Die Ästhetik ist ein gelöstes, konvergiertes Problem; der Wert steckt woanders:

- **Uniformes Datenmodell:** SPO/Entity-Relationship-Tripel **mit Provenienz** (`{source, predicate, target, confidence, EXTRACTED|INFERRED}`) + **Entity-Dedup/Standardisierung** *vor* dem Graphen. (graphify, ai-knowledge-graph, aimaster konvergieren.)
- **„Schön" = Community-Detection + Färbung** (Leiden/Louvain) → Nodes nach Community gefärbt, Kanten nach Confidence. Plus **vorberechnete Layout-Positionen** im JSON mitliefern → Client rendert sofort ohne Kalt-Physik (ml-knowledge-graph).
- **Die Lücke = unsere Chance:** Fast **kein** LLM-Graph-Tool liefert einen *wirklich schönen, echt-3D, hochskaligen* View — die AI-Tools bleiben bei 2D-pyvis; die schönen Renderer kommen von der Obsidian-*Plugin*-Seite. Worlds and Beyond kann **beides koppeln**: graphify-artiges Extraktions-/Provenienz-/Community-Datenmodell **+** ein Pixi-oder-Three-Renderer. Unser vorhandener Pixi+3D-Kugel+Galaxy-Cluster-Stand ist bereits auf Best-in-Class-Render-Niveau.

---

## 5. Empfehlung → OFFENER Spike (nicht vorentscheiden)

**Drei tragfähige, MIT-lizenzierte Pfade** — der Spike misst sie gegeneinander, statt einen zu setzen:

1. **`3d-force-graph` / three.js** — echter rotierender 3D-Galaxy, schnellster Weg zum schönen Ergebnis, riesiges Ökosystem. 10k via **graphier**-Muster (Worker + Instancing). *Genau der Look, den der User will.*
2. **cosmos.gl** — maximale Skala (1M+), Galaxy nativ, GPU-Layout. Haken: nur Punkte+Linien (weniger Per-Node-Freiheit), am stärksten vom WebView2-WebGL-Wegfall exponiert.
3. **PixiJS v8 + d3-force** (Inkumbent) — max. Look-Kontrolle + schon verdrahtet; für 10k **d3-force in Web Worker / Layout vorberechnen**.

**Spike-Auftrag (offen):** Diese drei bei **10k Nodes + 3–5× Kanten** in echter **Tauri-WebView2** auf **echter GPU UND einem schwachen/VM-Ziel** prototypisieren (Wegwerf-PoCs, frei zu verwerfen/neu recherchieren). Messen: fps, Interaktion (Hover/Ego/Filter), Glow-Machbarkeit, **und v.a. das WebGL-Fail-Verhalten ohne GPU**. Architektur-Referenz: `CocoRoF/graphier`. Erst dieses Ergebnis fixiert D1/D2.

**Renderer-unabhängig JETZT wertvoll (unabhängig vom Spike-Ausgang):** das Datenmodell auf **SPO + Provenienz (EXTRACTED/INFERRED) + Community-Färbung + vorberechnete Positionen** heben — das ist der eigentliche Differenzierer und funktioniert unter jedem der drei Renderer.

## Quellen (Auswahl, alle am Repo/Doc verifiziert)
- Engines: [cosmos.gl](https://github.com/cosmosgl/graph) · [OpenJS cosmos.gl](https://openjsf.org/blog/introducing-cosmos-gl) · [3d-force-graph](https://github.com/vasturiano/3d-force-graph) · [Sigma.js](https://github.com/jacomyal/sigma.js/) · [deck.gl graph-layers](https://www.npmjs.com/package/@deck.gl-community/graph-layers) · [AntV G6](https://github.com/antvis/G6) · [Cytoscape WebGL preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/)
- WebView2/WebGL-Fallback: [MS Learn EnableUnsafeSwiftShader](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-policies/enableunsafeswiftshader) · [Chromium SwiftShader-Removal](https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM) · [Tauri #4891](https://github.com/tauri-apps/tauri/issues/4891)
- Scale-Referenz: [CocoRoF/graphier](https://github.com/CocoRoF/graphier) · [n23eos/advanced_graph_view](https://github.com/n23eos/advanced_graph_view) · [agentage/obsidian-galaxy](https://github.com/agentage/obsidian-galaxy)
- LLM-Graph-Datenmodell: [Graphify-Labs/graphify](https://github.com/Graphify-Labs/graphify) · [robert-mcdermott/ai-knowledge-graph](https://github.com/robert-mcdermott/ai-knowledge-graph) · [the-palindrome/ml-knowledge-graph](https://github.com/the-palindrome/ml-knowledge-graph) (echt-3D three.js) · [neo4j-labs/llm-graph-builder](https://github.com/neo4j-labs/llm-graph-builder)
- Cosmograph-Lizenz (nicht-kommerziell): [cosmograph.app/pricing](https://cosmograph.app/pricing/)
