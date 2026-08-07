// M16-S00b (#326) OPEN renderer bench harness. Same synthetic graph +
// same worker-computed layout through three engines (three.js / Pixi / Sigma),
// one at a time, with an fps / layout-ms / GPU overlay. Throwaway PoC.
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateBenchGraph } from './model';
import type { LayoutRequest, LayoutResult } from './layoutWorker';
import { getWebglInfo } from './webglInfo';
import { FpsMeter } from './fps';
import type { PositionMap, RendererAdapter, RendererHandle } from './adapters/types';
import { threeAdapter } from './adapters/threeAdapter';
import { pixiAdapter } from './adapters/pixiAdapter';
import { sigmaAdapter } from './adapters/sigmaAdapter';

type RendererName = 'three' | 'pixi' | 'sigma';
const ADAPTERS: Record<RendererName, RendererAdapter> = {
  three: threeAdapter,
  pixi: pixiAdapter,
  sigma: sigmaAdapter,
};
const NODE_COUNTS = [1000, 3000, 10000];

export function GraphBench(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<RendererHandle | null>(null);
  const meterRef = useRef(new FpsMeter(90));

  const [renderer, setRenderer] = useState<RendererName>('three');
  const [nodeCount, setNodeCount] = useState(3000);
  const [edgeFactor, setEdgeFactor] = useState(4);
  const [glow, setGlow] = useState(false);

  const [fps, setFps] = useState(0);
  const [layoutMs, setLayoutMs] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [glowNote, setGlowNote] = useState('');
  const [busy, setBusy] = useState(false);

  const gpu = useMemo(() => getWebglInfo(), []);

  // (re)build the scene when data or renderer changes
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    let generation = Symbol('gen');
    const myGen = generation;
    setBusy(true);

    handleRef.current?.dispose();
    handleRef.current = null;
    mountEl.innerHTML = '';

    const model = generateBenchGraph(nodeCount, edgeFactor);
    setEdgeCount(model.links.length);

    const dims: 2 | 3 = renderer === 'three' ? 3 : 2;
    // more ticks for smaller graphs (cheap); fewer for 10k (still settles enough)
    const ticks = nodeCount <= 1000 ? 300 : nodeCount <= 3000 ? 200 : 120;

    const worker = new Worker(new URL('./layoutWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (ev: MessageEvent<LayoutResult>) => {
      worker.terminate();
      if (myGen !== generation) return;
      setLayoutMs(Math.round(ev.data.ms));

      const positions: PositionMap = new Map();
      for (const p of ev.data.positions) positions.set(p.id, p);

      const rect = mountEl.getBoundingClientRect();
      const handle = await Promise.resolve(
        ADAPTERS[renderer](mountEl, model, positions, {
          width: Math.max(1, rect.width),
          height: Math.max(1, rect.height),
          glow,
          onFrame: (t) => meterRef.current.push(t),
        }),
      );
      if (myGen !== generation) { handle.dispose(); return; }
      handleRef.current = handle;
      setGlowNote(handle.glowNote);
      setBusy(false);
    };
    const req: LayoutRequest = { model, ticks, dims };
    worker.postMessage(req);

    return () => {
      generation = Symbol('stale');
      worker.terminate();
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [renderer, nodeCount, edgeFactor]); // glow handled live below

  useEffect(() => {
    handleRef.current?.setGlow(glow);
  }, [glow]);

  // display fps ~4x/s
  useEffect(() => {
    const iv = setInterval(() => setFps(Math.round(meterRef.current.value)), 250);
    return () => clearInterval(iv);
  }, []);

  // keep engine sized to the container
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;
    const ro = new ResizeObserver(() => {
      const r = mountEl.getBoundingClientRect();
      handleRef.current?.resize(Math.max(1, r.width), Math.max(1, r.height));
    });
    ro.observe(mountEl);
    return () => ro.disconnect();
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0b0d10', color: '#e8eef5', fontFamily: 'system-ui, sans-serif' }}>
      <div ref={mountRef} style={{ position: 'absolute', inset: 0 }} />

      <div style={{
        position: 'absolute', top: 12, left: 12, padding: '12px 14px',
        background: 'rgba(20,24,30,0.82)', borderRadius: 10, fontSize: 13,
        display: 'flex', flexDirection: 'column', gap: 8, minWidth: 260,
        backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <strong style={{ fontSize: 14 }}>M16 Renderer-Bench (#326)</strong>

        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(ADAPTERS) as RendererName[]).map((r) => (
            <button
              key={r}
              onClick={() => setRenderer(r)}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.15)',
                background: renderer === r ? '#3a6ea5' : 'transparent',
                color: '#e8eef5', textTransform: 'capitalize',
              }}
            >{r}</button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {NODE_COUNTS.map((c) => (
            <button
              key={c}
              onClick={() => setNodeCount(c)}
              style={{
                flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.15)',
                background: nodeCount === c ? '#3a6ea5' : 'transparent',
                color: '#e8eef5',
              }}
            >{c >= 1000 ? `${c / 1000}k` : c}</button>
          ))}
        </div>

        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Kanten / Node: {edgeFactor}x
          <input type="range" min={2} max={6} step={1} value={edgeFactor}
            onChange={(e) => setEdgeFactor(Number(e.target.value))} style={{ width: 120 }} />
        </label>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={glow} onChange={(e) => setGlow(e.target.checked)} />
          Glow {renderer === 'sigma' ? '(bei Sigma nicht nativ)' : ''}
        </label>

        <hr style={{ width: '100%', border: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px', fontVariantNumeric: 'tabular-nums' }}>
          <span>fps</span><strong style={{ color: fps >= 50 ? '#8fd97a' : fps >= 25 ? '#f2c94c' : '#f0716a' }}>{busy ? '…' : fps}</strong>
          <span>Layout</span><span>{layoutMs} ms (Worker)</span>
          <span>Nodes</span><span>{nodeCount.toLocaleString('de-DE')}</span>
          <span>Kanten</span><span>{edgeCount.toLocaleString('de-DE')}</span>
        </div>

        <hr style={{ width: '100%', border: 0, borderTop: '1px solid rgba(255,255,255,0.1)' }} />

        <div style={{ fontSize: 11, lineHeight: 1.4 }}>
          <div style={{ color: !gpu.ok ? '#f0716a' : gpu.software ? '#f2c94c' : '#8fd97a' }}>
            {!gpu.ok ? 'WebGL2 FEHLGESCHLAGEN (WebView2 v144+ ohne SwiftShader-Fallback)'
              : gpu.software ? 'SOFTWARE-WebGL (kein echter GPU-Speedup)'
              : 'GPU-beschleunigt'}
          </div>
          <div style={{ opacity: 0.7, wordBreak: 'break-word' }}>{gpu.renderer}</div>
          <div style={{ opacity: 0.7, marginTop: 4 }}>Glow: {glowNote || '-'}</div>
        </div>
      </div>
    </div>
  );
}

export default GraphBench;
