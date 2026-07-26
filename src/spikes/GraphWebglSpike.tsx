// M16-S00 (#320) SPIKE: de-risks react-force-graph-3d + Bloom at ~10k nodes
// in the real Tauri v2 WebView (WebView2) before S03-S07 get built. Throwaway
// PoC — synthetic data only, no DB/schema, not reachable from the main app.
// Read the fps/timing numbers on screen and report back; fill the verdict
// into planning/research/graph-webgl-tauri-spike.md.
import { useEffect, useMemo, useRef, useState } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import type { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-3d';
import * as THREE from 'three';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

interface SpikeNode {
  id: string;
  group: number;
}

interface SpikeLink {
  source: string;
  target: string;
}

const GROUP_COUNT = 8;

function generateGraph(nodeCount: number, linkCount: number): { nodes: SpikeNode[]; links: SpikeLink[] } {
  const nodes: SpikeNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    id: `n${i}`,
    group: i % GROUP_COUNT,
  }));
  const links: SpikeLink[] = Array.from({ length: linkCount }, () => {
    const a = Math.floor(Math.random() * nodeCount);
    let b = Math.floor(Math.random() * nodeCount);
    if (b === a) b = (b + 1) % nodeCount;
    return { source: `n${a}`, target: `n${b}` };
  });
  return { nodes, links };
}

export function GraphWebglSpike() {
  const fgRef = useRef<ForceGraphMethods<NodeObject<SpikeNode>, LinkObject<SpikeNode, SpikeLink>>>(undefined);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  const [nodeCount, setNodeCount] = useState(10000);
  const [linkCount, setLinkCount] = useState(15000);
  const [genKey, setGenKey] = useState(0);
  const [dims, setDims] = useState<1 | 2 | 3>(2);

  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [bloomStrength, setBloomStrength] = useState(1.2);
  const [bloomRadius, setBloomRadius] = useState(0.6);
  const [bloomThreshold, setBloomThreshold] = useState(0.1);

  const [fps, setFps] = useState(0);
  const [engineStopMs, setEngineStopMs] = useState<number | null>(null);
  const warmupStartRef = useRef(0);

  // genKey forces a fresh dataset when "Neu generieren" is clicked, even if
  // node/link counts are unchanged.
  const graphData = useMemo(() => generateGraph(nodeCount, linkCount), [nodeCount, linkCount, genKey]);

  // Bloom post-processing pass — re-applied whenever params/genKey change,
  // since the composer can be a fresh instance after a data reset.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const composer = fg.postProcessingComposer();
    if (bloomPassRef.current) {
      composer.removePass(bloomPassRef.current);
      bloomPassRef.current = null;
    }
    if (bloomEnabled) {
      const pass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        bloomStrength, bloomRadius, bloomThreshold,
      );
      composer.addPass(pass);
      bloomPassRef.current = pass;
    }
  }, [bloomEnabled, bloomStrength, bloomRadius, bloomThreshold, genKey]);

  // Manual rAF fps counter — react-force-graph-3d has no built-in readout.
  useEffect(() => {
    let frames = 0;
    let raf = 0;
    let lastReport = performance.now();
    function tick() {
      frames++;
      const now = performance.now();
      if (now - lastReport >= 500) {
        setFps(Math.round((frames * 1000) / (now - lastReport)));
        frames = 0;
        lastReport = now;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    warmupStartRef.current = performance.now();
    setEngineStopMs(null);
  }, [genKey, nodeCount, linkCount]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#0b0d10' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        numDimensions={dims}
        nodeAutoColorBy="group"
        nodeVal={1}
        nodeLabel={(n: NodeObject<SpikeNode>) => `${n.id} (Gruppe ${n.group})`}
        linkOpacity={0.2}
        linkWidth={0.4}
        cooldownTicks={100}
        onEngineStop={() => setEngineStopMs(Math.round(performance.now() - warmupStartRef.current))}
        enableNavigationControls
        showNavInfo={false}
        backgroundColor="#0b0d10"
      />
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>#320 Graph-Spike — Live-Messwerte</div>
        <div>fps: <b style={{ color: fps >= 45 ? '#4caf50' : fps >= 25 ? '#e0a53f' : '#e05353' }}>{fps}</b></div>
        <div>Nodes: {graphData.nodes.length.toLocaleString('de-DE')} · Links: {graphData.links.length.toLocaleString('de-DE')}</div>
        <div>Force-Sim Konvergenz: {engineStopMs === null ? 'läuft…' : `${engineStopMs} ms`}</div>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          Nodes
          <input type="number" min={100} step={500} value={nodeCount} onChange={(e) => setNodeCount(Number(e.target.value))} style={inputStyle} />
        </label>
        <label style={rowStyle}>
          Links
          <input type="number" min={100} step={500} value={linkCount} onChange={(e) => setLinkCount(Number(e.target.value))} style={inputStyle} />
        </label>
        <button type="button" onClick={() => setGenKey((k) => k + 1)} style={btnStyle}>Neu generieren</button>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          Kamera-Dimensionen
          <select value={dims} onChange={(e) => setDims(Number(e.target.value) as 1 | 2 | 3)} style={inputStyle}>
            <option value={3}>3D</option>
            <option value={2}>2D (flach, top-down)</option>
          </select>
        </label>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          <input type="checkbox" checked={bloomEnabled} onChange={(e) => setBloomEnabled(e.target.checked)} />
          Bloom aktiv
        </label>
        <label style={rowStyle}>
          Strength ({bloomStrength.toFixed(2)})
          <input type="range" min={0} max={3} step={0.05} value={bloomStrength} disabled={!bloomEnabled} onChange={(e) => setBloomStrength(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Radius ({bloomRadius.toFixed(2)})
          <input type="range" min={0} max={1} step={0.05} value={bloomRadius} disabled={!bloomEnabled} onChange={(e) => setBloomRadius(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Threshold ({bloomThreshold.toFixed(2)})
          <input type="range" min={0} max={1} step={0.05} value={bloomThreshold} disabled={!bloomEnabled} onChange={(e) => setBloomThreshold(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

const panelStyle: React.CSSProperties = {
  position: 'absolute', top: 12, left: 12, zIndex: 10,
  background: 'rgba(20,22,26,0.85)', color: '#e8e9eb',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
  padding: '10px 14px', fontSize: 13, fontFamily: 'monospace',
  width: 240, backdropFilter: 'blur(4px)',
};
const hrStyle: React.CSSProperties = { border: 'none', borderTop: '1px solid rgba(255,255,255,0.15)', margin: '8px 0' };
const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, margin: '4px 0' };
const inputStyle: React.CSSProperties = { width: 90, background: '#1c1f23', color: '#e8e9eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4 };
const btnStyle: React.CSSProperties = { width: '100%', marginTop: 6, padding: '4px 8px', background: '#2a2f35', color: '#e8e9eb', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, cursor: 'pointer' };

export default GraphWebglSpike;
