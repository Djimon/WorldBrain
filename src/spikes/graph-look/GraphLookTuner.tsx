// M16-S03 look-tuning harness (throwaway, own window). Drives the REAL
// production GraphCanvas so tuned values transfer 1:1. 1k/3k/10k synthetic
// graphs + live sliders for every look knob. Layout is computed ONCE per node
// count (positions passed in) so slider drags rebuild only the scene, never
// the force sim -> responsive even at 10k. Copy the readout block to me and I
// bake the values into DEFAULT_LOOK (GraphCanvas.tsx).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GraphCanvas } from '../../ui/GraphCanvas';
import type { GraphLookConfig, GraphPosition } from '../../ui/GraphCanvas';
import { DEFAULT_LOOK } from '../../ui/GraphCanvas';
import { typeColor, edgeStyle } from '../../services/graph-style';
import type { GraphLink, GraphModel, GraphNode } from '../../services/graph-model';
import { computeGalaxyLayout3D } from '../../services/galaxy-layout';
import { generateBenchGraph } from '../graph-bench/model';

const NODE_COUNTS = [1000, 3000, 10000];
const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

function benchToModel(nodeCount: number): GraphModel {
  const b = generateBenchGraph(nodeCount);
  const nodes: GraphNode[] = b.nodes.map((n) => ({ id: n.id, type: n.type, label: n.id, degree: n.degree }));
  const links: GraphLink[] = b.links.map((l) => ({ source: l.source, target: l.target, kind: l.kind }));
  return { nodes, links };
}

function Slider(props: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
      <span style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>{props.label}</span>
        <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{props.value.toFixed(2)}</strong>
      </span>
      <input
        type="range" min={props.min} max={props.max} step={props.step} value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function GraphLookTuner(): React.ReactElement {
  const [nodeCount, setNodeCount] = useState(3000);
  const [glow, setGlow] = useState(false);
  const [showMentions, setShowMentions] = useState(true);

  // look knobs (az/el kept in DEGREES for the UI)
  const [bloomStrength, setBloomStrength] = useState(DEFAULT_LOOK.bloomStrength);
  const [bloomRadius, setBloomRadius] = useState(DEFAULT_LOOK.bloomRadius);
  const [bloomThreshold, setBloomThreshold] = useState(DEFAULT_LOOK.bloomThreshold);
  const [radiusScale, setRadiusScale] = useState(DEFAULT_LOOK.radiusScale);
  const [lightAzDeg, setLightAzDeg] = useState(DEFAULT_LOOK.lightAzimuth * RAD2DEG);
  const [lightElDeg, setLightElDeg] = useState(DEFAULT_LOOK.lightElevation * RAD2DEG);
  const [lightIntensity, setLightIntensity] = useState(DEFAULT_LOOK.lightIntensity);
  const [ambientIntensity, setAmbientIntensity] = useState(DEFAULT_LOOK.ambientIntensity);
  const [dimFactor, setDimFactor] = useState(DEFAULT_LOOK.dimFactor);
  const [fit, setFit] = useState(DEFAULT_LOOK.fit);
  const [camDistanceFactor, setCamDistanceFactor] = useState(DEFAULT_LOOK.camDistanceFactor);
  const [sizeSpread, setSizeSpread] = useState(6);
  const [edgeWidthScale, setEdgeWidthScale] = useState(DEFAULT_LOOK.edgeWidthScale);
  const [edgeOpacityScale, setEdgeOpacityScale] = useState(DEFAULT_LOOK.edgeOpacityScale);
  const [edgesHidden, setEdgesHidden] = useState(true);
  const [revealDepth, setRevealDepth] = useState(1);

  const model = useMemo(() => benchToModel(nodeCount), [nodeCount]);
  const maxDeg = useMemo(() => Math.max(1, ...model.nodes.map((n) => n.degree)), [model]);

  const links = useMemo(
    () => (showMentions ? model.links : model.links.filter((l) => l.kind !== 'mention')),
    [model, showMentions],
  );

  // layout ONCE per node count (heavy) — slider changes never touch this.
  const [positions, setPositions] = useState<GraphPosition[] | null>(null);
  const [computing, setComputing] = useState(false);
  useEffect(() => {
    setComputing(true);
    setPositions(null);
    const t = setTimeout(() => {
      const pos = computeGalaxyLayout3D(model.nodes, model.links);
      setPositions(pos.map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z })));
      setComputing(false);
    }, 0);
    return () => clearTimeout(t);
  }, [model]);

  const nodeStyle = useCallback(
    (n: GraphNode) => {
      const t = Math.sqrt(n.degree / maxDeg);
      return { color: typeColor(n.type), radius: 12 * Math.pow(1 + sizeSpread, t - 0.5) };
    },
    [maxDeg, sizeSpread],
  );

  const look: Partial<GraphLookConfig> = useMemo(() => ({
    bloomStrength, bloomRadius, bloomThreshold, radiusScale,
    lightAzimuth: lightAzDeg * DEG2RAD, lightElevation: lightElDeg * DEG2RAD,
    lightIntensity, ambientIntensity, dimFactor, fit, camDistanceFactor,
    edgeWidthScale, edgeOpacityScale,
  }), [bloomStrength, bloomRadius, bloomThreshold, radiusScale, lightAzDeg, lightElDeg, lightIntensity, ambientIntensity, dimFactor, fit, camDistanceFactor, edgeWidthScale, edgeOpacityScale]);

  const onNavigate = useCallback((id: string) => { console.log('navigate', id); }, []);

  const readout = JSON.stringify({ ...look, sizeSpread, edgesHidden, edgeRevealDepth: revealDepth, glow }, null, 2);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d10', color: '#e8eef5', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        {positions && <GraphCanvas
          nodes={model.nodes}
          links={links}
          positions={positions}
          nodeStyle={nodeStyle}
          edgeStyle={edgeStyle}
          look={look}
          glowEnabled={glow}
          edgesHidden={edgesHidden}
          edgeRevealDepth={revealDepth}
          layout={{ mode: 'galaxy' }}
          onNavigate={onNavigate}
        />}
        {computing && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', opacity: 0.7 }}>
            rechne Layout ({nodeCount.toLocaleString('de-DE')} Nodes)...
          </div>
        )}
      </div>

      <div style={{
        position: 'absolute', top: 12, left: 12, width: 300, maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
        padding: '12px 14px', background: 'rgba(20,24,30,0.9)', borderRadius: 10,
        display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <strong style={{ fontSize: 14 }}>M16 Look-Tuner (GraphCanvas)</strong>

        <div style={{ display: 'flex', gap: 6 }}>
          {NODE_COUNTS.map((c) => (
            <button key={c} onClick={() => setNodeCount(c)} style={{
              flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer',
              border: '1px solid rgba(255,255,255,0.15)',
              background: nodeCount === c ? '#3a6ea5' : 'transparent', color: '#e8eef5',
            }}>{c / 1000}k</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={glow} onChange={(e) => setGlow(e.target.checked)} /> Glow/Bloom
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={showMentions} onChange={(e) => setShowMentions(e.target.checked)} /> Mentions
          </label>
        </div>

        <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 11, opacity: 0.7 }}>Bloom (nur bei Glow)</legend>
          <Slider label="strength" value={bloomStrength} min={0} max={4} step={0.05} onChange={setBloomStrength} />
          <Slider label="radius" value={bloomRadius} min={0} max={2} step={0.05} onChange={setBloomRadius} />
          <Slider label="threshold" value={bloomThreshold} min={0} max={1} step={0.01} onChange={setBloomThreshold} />
        </fieldset>

        <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 11, opacity: 0.7 }}>Kugeln</legend>
          <Slider label="Kugel-Groesse (radiusScale)" value={radiusScale} min={0.1} max={2.5} step={0.05} onChange={setRadiusScale} />
          <Slider label="Groessen-Unterschied (spread)" value={sizeSpread} min={0} max={30} step={0.5} onChange={setSizeSpread} />
          <Slider label="Hover-Dim" value={dimFactor} min={0} max={1} step={0.02} onChange={setDimFactor} />
        </fieldset>

        <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 11, opacity: 0.7 }}>Kanten</legend>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={edgesHidden} onChange={(e) => setEdgesHidden(e.target.checked)} />
            Kanten ausblenden (nur n-Nachbarschaft bei Hover/Klick)
          </label>
          <Slider label="Reveal-Tiefe n (Hops)" value={revealDepth} min={1} max={4} step={1} onChange={(v) => setRevealDepth(Math.round(v))} />
          <Slider label="Kanten-Breite" value={edgeWidthScale} min={0.1} max={5} step={0.1} onChange={setEdgeWidthScale} />
          <Slider label="Kanten-Opacity" value={edgeOpacityScale} min={0} max={3} step={0.05} onChange={setEdgeOpacityScale} />
        </fieldset>

        <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 11, opacity: 0.7 }}>Licht</legend>
          <Slider label="Azimut (horizontal, Grad)" value={lightAzDeg} min={-180} max={180} step={1} onChange={setLightAzDeg} />
          <Slider label="Elevation (vertikal, Grad)" value={lightElDeg} min={-90} max={90} step={1} onChange={setLightElDeg} />
          <Slider label="Intensitaet" value={lightIntensity} min={0} max={4} step={0.1} onChange={setLightIntensity} />
          <Slider label="Ambient" value={ambientIntensity} min={0} max={2} step={0.05} onChange={setAmbientIntensity} />
        </fieldset>

        <fieldset style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <legend style={{ fontSize: 11, opacity: 0.7 }}>Kamera</legend>
          <Slider label="Fit (Ausdehnung)" value={fit} min={200} max={1500} step={25} onChange={setFit} />
          <Slider label="Kamera-Abstand" value={camDistanceFactor} min={1} max={6} step={0.1} onChange={setCamDistanceFactor} />
        </fieldset>

        <div style={{ fontSize: 11, opacity: 0.7 }}>Werte (kopieren + schicken):</div>
        <pre style={{
          margin: 0, padding: 8, background: 'rgba(0,0,0,0.4)', borderRadius: 6, fontSize: 11,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>{readout}</pre>
      </div>
    </div>
  );
}

export default GraphLookTuner;
