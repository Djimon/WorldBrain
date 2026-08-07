# Verdict — Graph-Renderer-Spike (M16-S00, #320)

**Stand:** 2026-07-23 · **Ergebnis:** GO für einen Graphen — aber **2D auf PixiJS + d3-force**, NICHT react-force-graph-3d.

## Frage des Spikes

De-risk `react-force-graph-3d` + Bloom bei ~10k Nodes in der echten Tauri-WebView (WebView2), bevor M16-S03–S07 gebaut werden. Code: `src/spikes/GraphWebglSpike.tsx` (Wegwerf-PoC, synthetische Daten).

## Ergebnis

**1. „Echtes 3D" war die falsche Prämisse.** Die realen Anforderungen sind alle **2D mit Node-Styling**:
- 3D-Effekt der Kugeln → **Radial-Gradient / vorgebackenes Kugel-Sprite** (kein Licht/Kamera/three.js nötig).
- Leuchten → **Per-Node-Halo** (Sprite/`pixi-filters`), pro Node schaltbar — **nicht** Full-Screen-Bloom.
- Such-Ausblenden + Ego-Graph → Sichtbarkeits-Toggle (im Spike bereits gebaut).

Kein 3D-Freiflug, keine Kamera-Orbit gewünscht → der ganze 3D-Stack ist unnötig.

**2. Die 3D-Lib erzwingt Dauer-Workarounds.** Der Spike-Code belegt es: Headlight-Guard (250ms-`setInterval`, weil die Lib das Licht re-parented), Ego-Dim via Ref+Rebuild-Trick, Modus-Wechsel via Remount-Key, selektiver Bloom via Zwei-Composer-Custom-Pass-Tanz. Jede Custom-Interaktion kämpft gegen das declarative-rebuild-Modell von react-force-graph.

**3. Selektiver Bloom lohnt nicht (Negativergebnis).** Der komplexeste, fragilste Spike-Code (sRGB-Decode/Encode, zwei Composer) existiert nur, damit ausschließlich die Bubbles glühen. Der **Fake-Glow (Sprite-Halo pro Node)** — im Spike ebenfalls drin — ist billiger, robuster, „brennt nicht aus". → Halo statt Bloom.

**4. GPU-Fallback ist ein reales Produktrisiko.** Der Spike lief auf einer **GPU-losen VM** → Software-WebGL (SwiftShader), darum das 1000-Node-„Limit". Beim Endnutzer kann WebView2 **still auf Software-WebGL zurückfallen** (alte Treiber, RDP, VM, Stromsparen) → 3D-Graph unbenutzbar. 2D degradiert weit anmutiger; Software-Renderer erkennen (`WEBGL_debug_renderer_info`) + ggf. warnen bleibt ratsam.

## ⚠️ Offen (vor jeder Perf-Zusage)

- **Perf-Zahlen des Spikes sind ungültig** (Software-Renderer). **Re-Run auf echter GPU** — idealerweise zusätzlich auf schwachem-aber-echtem Zielgerät. Erst dann sind „hält 10k?", „Instancing nötig?", „Kanten-Rendering bei 10k+ Kanten" beantwortbar.
- **Kanten** sind Pixis Schwachpunkt (Relations + Mentions = 3–5× Nodes) → gebündeltes Kanten-Rendering; Default-View gefiltert/Ego, damit selten alles gleichzeitig gezeichnet wird.

## Entscheidung

**Renderer: PixiJS (2D WebGL) + d3-force.** Beide MIT/ISC (frei kommerziell). 3D-Effekt = Sprite-Kugel; Glow = Per-Node-Halo; Ego+Suche = Sichtbarkeits-Toggle; Kanten dick/dünn+transparent (nicht gestrichelt). Referenz-Rezept: Obsidian (Pixi+d3-force) und Graphifys D3-`graph.html`. **react-force-graph-3d / three.js entfallen.**

Übernommen ins Epic: `planning/epics/M16-knowledge-graph-visualization.md` (D1/D2/D8/D10/D11). Spike-Code `src/spikes/` ist wegwerfbar; die Learnings leben hier.

---

# Verdict-Teil 2 — OFFENER Renderer-Bench (M16-S00b, #326)

**Stand:** 2026-08-07 · **Ergebnis:** offen (Messung läuft) · ersetzt die Prämisse von Teil 1.

## Warum neu

Teil 1 war auf **eine vorgewählte Lösung** verengt (`react-force-graph-3d`) und lief auf **GPU-loser VM**
(Software-WebGL) → sein „2D statt 3D / max. 1000 Nodes"-Fazit ist **schwache Evidenz, kein Fakt**. Dieser
Bench öffnet den Optionsraum und misst **drei frei-kommerzielle (MIT/ISC) Engines gegeneinander** unter
fairen Bedingungen. Vollständige Landschaft: [`graph-view-landscape-2026-08.md`](graph-view-landscape-2026-08.md).

## Was gemessen wird — fair, gleiche Bedingungen

Alle drei rendern **dieselbe rotierbare 3D-Galaxy** aus **demselben synthetischen Graphen**
(`generateBenchGraph`, deterministisch) mit **derselben 3D-Layout-Berechnung** (`d3-force-3d`, `numDimensions=3`,
**im Web Worker**, blockiert das UI nicht). Isoliert **Render-Leistung** von **Layout-Leistung**.

**Die eigentliche Spike-Frage** (Korrektur nach User-Feedback): nicht „3D-Engine vs. 2D-Engine" — sondern
**kann eine 2D-Engine dieselbe rotierbare 3D-Galaxy liefern, indem sie die 3D→2D-Projektion pro Frame selbst
rechnet** (Muster: StellarGraph = handgerollte Projektion auf Canvas2D)? three.js macht 3D nativ; Pixi und
Sigma reprojizieren **jeden Frame** auf der CPU. Genau diese CPU-Reprojektion bei 3k/10k ist der Prüfstein.

| Engine | Nodes | Kanten | 3D-Weg | Glow | Nav |
|---|---|---|---|---|---|
| **three.js** (raw) | 1 InstancedMesh (per-instance Farbe+Scale) | 2 LineSegments (relation/mention) | **nativ** (GPU, OrbitControls) | UnrealBloomPass nativ (+ sRGB-Decode-Fix) | Rotate/Pan/Zoom |
| **Pixi v8** | 1 Sprite-Batch (geteilte Kugel-Textur, Tint) | **1 Graphics, jeden Frame neu, 2 Stroke-Batches** | **manuelle CPU-Projektion/Frame** (Sprites reprojiziert + depth-sort/-scale) | additiver Halo-Sprite pro Node | Rotate (Drag) / Zoom |
| **Sigma v3** | graphology, size=degree | eingebaut, size/color | **manuell: 10k x/y-Attribut-Rewrites/Frame + refresh** | **nicht nativ** (eigenes WebGL-Node-Program nötig) | Rotate (Drag) / Zoom (Kamera) |

Metriken im Overlay: **fps** (rolling avg), **Layout-ms** (Worker), Node/Kanten-Count, **GPU-Info**
(`WEBGL_debug_renderer_info` → echte GPU / Software-WebGL / Kontext-Fail = die Pflicht-Metrik aus Teil 1).
**Wichtig:** fps wird beim *Rotieren* gemessen (Dauer-Reprojektion) — genau dann trennt sich die Spreu.

## So läuft der Bench

`start-graph-bench.bat` (oder `npm run desktop:bench-graph`) → eigenes **Tauri-WebView2**-Fenster
(die echte Deployment-Oberfläche, wo der WebGL-Fail zählt). Im Overlay: Engine wählen, Node-Count
1k/3k/10k, Kanten-Multiplier 2-6x, Glow an/aus. Code: `src/spikes/graph-bench/` (Wegwerf-PoC).

Status Bau: TypeScript sauber, alle Module in Vite-WebView2 auflösbar (headless verifiziert).
**Live-fps-Messung steht aus** — auf dieser Maschine laufen 3k entspannt, 10k **nicht simulierbar**
→ 10k-Zeile auf echter/starker GPU messen.

## Messergebnis (User, 2026-08-07 — 3k auf dieser Maschine; 10k nicht simulierbar)

| Engine | Perf @3k | 3D-Optik | Kugeln | Glow | Fazit |
|---|---|---|---|---|---|
| **three.js** | entspannt (minimal langsamer als Pixi) | echt | **deutlich am besten** | **bester** (nativer Bloom) | **GEWINNER** |
| **Pixi v8** | entspannt, **minimal beste Perf** | ok (CPU-Projektion trägt @3k) | schlechter als three | **„absolut Müll"** | verliert auf Look |
| **Sigma v3** | — | — | — | — | **„kann gar nichts"** — disqualifiziert |

**Kernbefund:** Perf-Unterschied three ↔ Pixi @3k ist **marginal** (Pixi sogar minimal vorn) — **nicht** der Entscheider.
Entscheidend ist der **Look**: three.js' echte beleuchtete Kugeln + nativer Bloom schlagen Pixis Sprite-Kugeln +
Fake-Glow klar. Sigma liefert die 3D-Galaxy gar nicht brauchbar (10k x/y-Rewrites/Frame + Glow-Fehlanzeige). 10k-fps
auf starker GPU noch offen, kippt die Wahl aber nicht.

## Entscheidung (2026-08-07)

**Renderer: three.js (raw).** Im direkten Bench (gleicher Graph, gleiches d3-force-3d-Layout, rotierbare
3D-Galaxy in allen drei) gewinnt three.js — **auf dem Look, nicht der Perf**:

- **Perf ist Parität** @3k: Pixi war sogar **minimal schneller**, beide entspannt. Perf ist also NICHT der
  Entscheider. (Die CPU-Reprojektion pro Frame — Pixi Sprites+Kanten neu, Sigma 10k x/y-Rewrites — ist eher
  ein 10k-Skalierungsrisiko der 2D-Engines; three.js umgeht sie via Instancing/GPU-Transform.)
- **Look entscheidet**: three.js' **echte beleuchtete Kugeln** + **nativer Bloom** schlagen Pixis Sprite-Kugeln
  klar; **Pixis Fake-Glow war „absolut Müll"** (User). Tiefe/Parallax + Bloom kommen bei three.js umsonst,
  bei 2D nur als teure Handarbeit.
- **Sigma disqualifiziert**: liefert die 3D-Galaxy nicht brauchbar („kann gar nichts").

**Wichtige Bau-Vorgabe: raw three.js (InstancedMesh + eigene Passes), NICHT `react-force-graph-3d`.**
Der #320-Spike zeigte, dass die Kapsule-Lib (verzögerter Prop-Digest, re-parentet Lichter, baut Nodes neu)
Dauer-Workarounds erzwingt. Der Bench-Adapter (`adapters/threeAdapter.ts`) belegt: roh + d3-force-3d im
Worker ist sauber und schnell — das ist das Referenz-Rezept für M16.

→ Fixiert **D1/D2** im Epic (three.js statt Pixi-2D). Die renderer-abhängigen Decisions (D6/D7/D10/D11/D12,
GraphCanvas-Kontrakt, Cytoscape-Ausbau) müssen auf three.js umgeschrieben werden.
