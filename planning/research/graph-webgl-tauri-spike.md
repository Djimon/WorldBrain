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
