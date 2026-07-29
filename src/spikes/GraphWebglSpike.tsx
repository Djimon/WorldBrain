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
import bubbleSpriteUrl from './assets/bubble.png';

interface SpikeNode {
  id: string;
  group: number;
  val: number; // degree-based size — hub nodes render bigger, mirrors real entity importance
}

type LinkKind = 'relation' | 'mention';

interface SpikeLink {
  source: string;
  target: string;
  kind: LinkKind;
  strength: number; // 1-4, drives line thickness
}

const GROUP_COUNT = 8;
const GROUP_COLORS = ['#ff6b6b', '#4dabf7', '#69db7c', '#ffa94d', '#da77f2', '#63e6be', '#ffd43b', '#e599f7'];
const LINK_KIND_COLOR: Record<LinkKind, string> = {
  relation: '#ff8c69', // solid, thicker on average — an authored relation
  mention: '#5a6672', // fainter — a looser text mention
};
// Uneven cluster sizes and link density — some clusters bigger/denser than
// others, mirroring the reference (a few tight hubs, a few sparse ones)
// instead of one uniform random-graph blob.
const CLUSTER_SIZE_WEIGHT = [3, 1, 2, 1, 2.5, 1, 1.5, 1];
const CLUSTER_DENSITY = [1.8, 0.4, 1.2, 0.5, 1.5, 0.3, 0.9, 0.6];
// Most links stay inside a cluster (what makes it read as a separate blob);
// a thin slice of bridge links connects clusters to each other.
const INTRA_CLUSTER_SHARE = 0.88;
// Relations are the minority, deliberate connection; mentions are the
// looser, more frequent kind — matches the real entity/mention split.
const RELATION_SHARE = 0.35;

function pickTwoDistinct(arr: number[]): [number, number] {
  const i = Math.floor(Math.random() * arr.length);
  let j = Math.floor(Math.random() * arr.length);
  if (j === i) j = (j + 1) % arr.length;
  return [arr[i], arr[j]];
}

function randomLinkMeta(): { kind: LinkKind; strength: number } {
  const kind: LinkKind = Math.random() < RELATION_SHARE ? 'relation' : 'mention';
  // relations skew stronger, mentions skew weaker — not a hard rule, just a bias
  const strength = kind === 'relation'
    ? 2 + Math.floor(Math.random() * 3) // 2-4
    : 1 + Math.floor(Math.random() * 2); // 1-2
  return { kind, strength };
}

function generateGraph(nodeCount: number, linkCount: number): { nodes: SpikeNode[]; links: SpikeLink[] } {
  const totalWeight = CLUSTER_SIZE_WEIGHT.reduce((a, b) => a + b, 0);
  const byCluster: number[][] = Array.from({ length: GROUP_COUNT }, () => []);
  const groupOfNode: number[] = [];
  let nodeIdx = 0;
  for (let c = 0; c < GROUP_COUNT; c++) {
    const isLast = c === GROUP_COUNT - 1;
    const count = isLast ? nodeCount - nodeIdx : Math.round((CLUSTER_SIZE_WEIGHT[c] / totalWeight) * nodeCount);
    for (let i = 0; i < count; i++, nodeIdx++) {
      byCluster[c].push(nodeIdx);
      groupOfNode.push(c);
    }
  }

  const links: SpikeLink[] = [];
  const intraCount = Math.round(linkCount * INTRA_CLUSTER_SHARE);
  const interCount = linkCount - intraCount;

  const clusterLinkWeight = byCluster.map((arr, i) => arr.length * CLUSTER_DENSITY[i]);
  const totalLinkWeight = clusterLinkWeight.reduce((a, b) => a + b, 0) || 1;
  for (let c = 0; c < GROUP_COUNT; c++) {
    const arr = byCluster[c];
    if (arr.length < 2) continue;
    // Capped at ~8x the cluster's own size (average degree ~16 within it) —
    // uncapped, a small-but-dense cluster's share could hugely exceed its
    // node count, repeatedly re-pairing the same few nodes until one of them
    // has a degree in the hundreds and renders as a single giant sprite.
    const rawShare = Math.round((clusterLinkWeight[c] / totalLinkWeight) * intraCount);
    const share = Math.min(rawShare, arr.length * 8);
    for (let i = 0; i < share; i++) {
      const [a, b] = pickTwoDistinct(arr);
      links.push({ source: `n${a}`, target: `n${b}`, ...randomLinkMeta() });
    }
  }

  for (let i = 0; i < interCount; i++) {
    const c1 = Math.floor(Math.random() * GROUP_COUNT);
    let c2 = Math.floor(Math.random() * GROUP_COUNT);
    if (c2 === c1) c2 = (c2 + 1) % GROUP_COUNT;
    const arr1 = byCluster[c1];
    const arr2 = byCluster[c2];
    if (!arr1.length || !arr2.length) continue;
    const a = arr1[Math.floor(Math.random() * arr1.length)];
    const b = arr2[Math.floor(Math.random() * arr2.length)];
    links.push({ source: `n${a}`, target: `n${b}`, ...randomLinkMeta() });
  }

  // Degree-based size, scaled RELATIVE to this dataset's own max degree
  // (not an absolute formula) — guarantees a clearly visible small-to-big
  // spread (well-connected hubs read as bigger/organic) regardless of how
  // many nodes/links were generated, and can't blow up into a giant outlier
  // sprite since it's bounded by the dataset's actual max, capped at 1.
  const degree = new Array<number>(nodeIdx).fill(0);
  for (const link of links) {
    degree[Number(link.source.slice(1))]++;
    degree[Number(link.target.slice(1))]++;
  }
  const maxDegree = Math.max(...degree, 1);
  const nodes: SpikeNode[] = groupOfNode.map((group, i) => ({
    id: `n${i}`, group, val: 1 + Math.sqrt(degree[i] / maxDegree) * 6,
  }));

  return { nodes, links };
}

// Solid core texture, from the actual reference sprite (_design/bubble.png,
// a real shaded-sphere render) instead of a hand-rolled canvas gradient —
// several rounds of guessing at gradient stops blind never matched what was
// wanted. The source PNG's background is opaque white, not alpha-
// transparent, so this draws it through a circular clip: a hard geometric
// mask (not a color/luminance guess) that leaves everything outside the
// sphere's own circle transparent, avoiding a white square behind every
// node. Colored per group via SpriteMaterial.color, same as before.
//
// Image loading is async; the same THREE.Texture object is returned
// immediately (so sprites can reference it right away) and its content is
// filled in once the image actually loads (needsUpdate re-uploads it to the
// GPU) — any sprite created before that point just updates in place.
let solidTexture: THREE.Texture | null = null;
function getSolidTexture(): THREE.Texture {
  if (solidTexture) return solidTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  solidTexture = new THREE.CanvasTexture(canvas);

  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    // Slightly inset (98%) so no sliver of the source's white background
    // survives at the very edge.
    ctx.arc(size / 2, size / 2, (size / 2) * 0.98, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 0, 0, size, size);
    ctx.restore();
    solidTexture!.needsUpdate = true;
  };
  img.src = bubbleSpriteUrl;

  return solidTexture;
}

const solidMaterialCache = new Map<string, THREE.SpriteMaterial>();
function getSolidMaterial(color: string): THREE.SpriteMaterial {
  const cached = solidMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.SpriteMaterial({
    map: getSolidTexture(),
    color,
    transparent: true,
    // depthWrite ON (was off) — with the texture now essentially opaque,
    // this registers the sphere's actual depth so links passing behind it
    // get properly occluded instead of drawing straight through it.
    depthWrite: true,
    // A Sprite's actual geometry is a full square quad — depthWrite alone
    // writes depth for the WHOLE square, including the fully-transparent
    // corners outside the circular gradient. Those invisible corners then
    // incorrectly occlude whatever's behind them (links, other nodes),
    // showing up as rectangular artifacts. alphaTest discards fragments
    // below this threshold before they ever reach the depth buffer, so
    // only the actually-visible circular part occludes anything.
    alphaTest: 0.05,
    // Nodes opt out of the scene fog below — only links should fade with
    // distance, not the spheres themselves.
    fog: false,
  });
  solidMaterialCache.set(color, material);
  return material;
}

// Real distance-based alpha fade for links — THREE.Fog only blends color
// toward the fog color (never touches alpha), which reads as a harsh dark
// smear rather than "fading to invisible". This shader instead computes the
// per-pixel distance from the camera to the link's actual world position
// (cameraPosition is a built-in three.js uniform, updated automatically each
// frame — no per-frame JS needed) and fades alpha with it directly.
const LINK_FADE_VERTEX_SHADER = `
  varying vec3 vWorldPosition;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;
const LINK_FADE_FRAGMENT_SHADER = `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uFadeNear;
  uniform float uFadeFar;
  uniform float uFadeEnabled;
  varying vec3 vWorldPosition;
  void main() {
    float dist = distance(cameraPosition, vWorldPosition);
    float fade = mix(1.0, 1.0 - smoothstep(uFadeNear, uFadeFar, dist), uFadeEnabled);
    gl_FragColor = vec4(uColor, uOpacity * fade);
  }
`;

const linkFadeMaterialCache = new Map<LinkKind, THREE.ShaderMaterial>();
function getLinkFadeMaterial(kind: LinkKind): THREE.ShaderMaterial {
  const cached = linkFadeMaterialCache.get(kind);
  if (cached) return cached;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(LINK_KIND_COLOR[kind]) },
      uOpacity: { value: 0.85 },
      uFadeNear: { value: 100 },
      uFadeFar: { value: 800 },
      uFadeEnabled: { value: 0 },
    },
    vertexShader: LINK_FADE_VERTEX_SHADER,
    fragmentShader: LINK_FADE_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
  });
  linkFadeMaterialCache.set(kind, material);
  return material;
}

export function GraphWebglSpike() {
  const fgRef = useRef<ForceGraphMethods<NodeObject<SpikeNode>, LinkObject<SpikeNode, SpikeLink>>>(undefined);
  const bloomPassRef = useRef<UnrealBloomPass | null>(null);

  // react-force-graph-3d only measures its container once at mount unless
  // given explicit width/height — without these, resizing the actual OS
  // window afterward left the canvas stuck at its original size (visible as
  // a confined horizontal strip with black bars above/below once the
  // window was resized/maximized). Tracking window size explicitly and
  // passing it down keeps the renderer in sync.
  const [viewportSize, setViewportSize] = useState({ width: window.innerWidth, height: window.innerHeight });
  useEffect(() => {
    function handleResize() {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [nodeCount, setNodeCount] = useState(10000);
  const [linkCount, setLinkCount] = useState(15000);
  const [genKey, setGenKey] = useState(0);
  const [dims, setDims] = useState<1 | 2 | 3>(2);

  // NOTE: the earlier "grey haze over everything" was live-confirmed to NOT
  // be about these values (it persisted even at strength=0) — root cause
  // still open, an OutputPass/color-space fix was tried and reverted (no
  // visible difference). These defaults are just a reasonable starting
  // point, not a workaround for that bug.
  //
  // Separate, still-true limitation: true "selective bloom" (only specific
  // objects glow, background never touched, even with high density/strength)
  // needs a two-composer setup — render bloom-only objects to an offscreen
  // buffer, then additively combine with the normal render via a custom
  // shader. This library owns its own render loop and only exposes one
  // shared composer, so that isn't reachable without patching its internals.
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [bloomStrength, setBloomStrength] = useState(0.6);
  const [bloomRadius, setBloomRadius] = useState(0.25);
  const [bloomThreshold, setBloomThreshold] = useState(0.85);
  const [showLinks, setShowLinks] = useState(true);
  // Default OFF (straight lines) — curved links force per-link curve/tube
  // geometry instead of a plain THREE.Line, which tanked fps at 15k links
  // (live-confirmed). Slider stays available to deliberately re-test it.
  const [linkCurvature, setLinkCurvature] = useState(0);
  const [linkOpacity, setLinkOpacity] = useState(0.85);
  const [relationColor, setRelationColor] = useState(LINK_KIND_COLOR.relation);
  const [mentionColor, setMentionColor] = useState(LINK_KIND_COLOR.mention);
  // Real distance-based alpha fade for links (getLinkFadeMaterial's shader)
  // — replaces an earlier attempt using THREE.Fog, which only blends color
  // toward the fog color and never touches alpha, so it faded to a harsh
  // near-black tint instead of actually disappearing.
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogNear, setFogNear] = useState(100);
  const [fogFar, setFogFar] = useState(800);
  // Lets you A/B the library's own default node rendering (real lit 3D
  // spheres via nodeAutoColorBy) against the hand-tuned sprite rendering
  // below, live, instead of guessing blind at which one you actually want.
  const [useCustomNodeRender, setUseCustomNodeRender] = useState(true);

  const [fps, setFps] = useState(0);
  const [engineStopMs, setEngineStopMs] = useState<number | null>(null);
  const warmupStartRef = useRef(0);

  // genKey forces a fresh dataset when "Neu generieren" is clicked, even if
  // node/link counts are unchanged.
  const graphData = useMemo(() => generateGraph(nodeCount, linkCount), [nodeCount, linkCount, genKey]);

  // Bloom post-processing pass — re-applied whenever params/genKey change,
  // since the composer can be a fresh instance after a data reset OR after
  // the ForceGraph3D remount below (useCustomNodeRender changes its key) —
  // both create a brand new composer that needs the pass re-added; without
  // useCustomNodeRender in the deps here, bloom would silently stop applying
  // after switching render modes.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const composer = fg.postProcessingComposer();
    const renderer = fg.renderer();
    if (bloomPassRef.current) {
      composer.removePass(bloomPassRef.current);
      bloomPassRef.current = null;
    }
    // UnrealBloomPass's own source (three/examples/jsm/postprocessing/
    // UnrealBloomPass.js) states directly in its JSDoc: "When using this
    // pass, tone mapping must be enabled in the renderer settings." This
    // renderer defaults to NoToneMapping (3d-force-graph never sets it,
    // since it wasn't built assuming bloom would be added) — a documented
    // requirement this was missing entirely, not a guess.
    renderer.toneMapping = bloomEnabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    if (bloomEnabled) {
      // window.innerWidth/innerHeight are CSS pixels; the actual WebGL
      // drawing buffer is that times devicePixelRatio. Passing the CSS size
      // as the bloom pass's resolution left its internal render targets
      // smaller than the real canvas whenever devicePixelRatio > 1 (e.g.
      // Windows display scaling), which showed up as a hard-edged grey
      // rectangle covering only part of the screen once bloom was enabled.
      const size = renderer.getSize(new THREE.Vector2());
      const pixelRatio = renderer.getPixelRatio();
      const pass = new UnrealBloomPass(
        new THREE.Vector2(size.x * pixelRatio, size.y * pixelRatio),
        bloomStrength, bloomRadius, bloomThreshold,
      );
      composer.addPass(pass);
      bloomPassRef.current = pass;
    }
  }, [bloomEnabled, bloomStrength, bloomRadius, bloomThreshold, genKey, useCustomNodeRender, viewportSize]);

  // Pushes the current slider/picker values into the two shared link-fade
  // shader materials (one per LinkKind) — no need to recreate them, just
  // update their uniforms in place.
  useEffect(() => {
    const colorByKind: Record<LinkKind, string> = { relation: relationColor, mention: mentionColor };
    (['relation', 'mention'] as LinkKind[]).forEach((kind) => {
      const material = getLinkFadeMaterial(kind);
      material.uniforms.uColor.value.set(colorByKind[kind]);
      material.uniforms.uOpacity.value = linkOpacity;
      material.uniforms.uFadeNear.value = fogNear;
      material.uniforms.uFadeFar.value = fogFar;
      material.uniforms.uFadeEnabled.value = fogEnabled ? 1 : 0;
    });
  }, [linkOpacity, fogNear, fogFar, fogEnabled, relationColor, mentionColor]);

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
        // Force a clean remount on mode switch — toggling nodeThreeObject
        // between a function and undefined at runtime left orphaned Sprite
        // objects behind (visible as faint square artifacts, sprites being
        // flat square planes) instead of properly falling back to the
        // library's default sphere mesh. A fresh instance sidesteps needing
        // to trust the library's internal diffing for this transition.
        key={useCustomNodeRender ? 'custom' : 'default'}
        ref={fgRef}
        width={viewportSize.width}
        height={viewportSize.height}
        graphData={graphData}
        numDimensions={dims}
        nodeVal={(n: NodeObject<SpikeNode>) => n.val}
        nodeLabel={(n: NodeObject<SpikeNode>) => `${n.id} (Gruppe ${n.group})`}
        nodeAutoColorBy={useCustomNodeRender ? undefined : 'group'}
        nodeThreeObject={useCustomNodeRender ? (n: NodeObject<SpikeNode>) => {
          const color = GROUP_COLORS[n.group % GROUP_COLORS.length];
          const core = new THREE.Sprite(getSolidMaterial(color));
          const coreSize = 5 + n.val * 2.5;
          core.scale.set(coreSize, coreSize, 1);
          return core;
        } : undefined}
        nodeThreeObjectExtend={false}
        linkVisibility={() => showLinks}
        linkMaterial={(l: LinkObject<SpikeNode, SpikeLink>) => getLinkFadeMaterial(l.kind)}
        linkCurvature={linkCurvature}
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
          <input type="checkbox" checked={showLinks} onChange={(e) => setShowLinks(e.target.checked)} />
          Kanten anzeigen
        </label>
        <label style={rowStyle}>
          Relation
          <input type="color" value={relationColor} disabled={!showLinks} onChange={(e) => setRelationColor(e.target.value)} />
        </label>
        <label style={rowStyle}>
          Mention
          <input type="color" value={mentionColor} disabled={!showLinks} onChange={(e) => setMentionColor(e.target.value)} />
        </label>
        <label style={rowStyle}>
          Bogen ({linkCurvature.toFixed(2)})
          <input type="range" min={0} max={0.8} step={0.05} value={linkCurvature} disabled={!showLinks} onChange={(e) => setLinkCurvature(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Kanten-Deckkraft ({linkOpacity.toFixed(2)})
          <input type="range" min={0.1} max={1} step={0.05} value={linkOpacity} disabled={!showLinks} onChange={(e) => setLinkOpacity(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          <input type="checkbox" checked={fogEnabled} onChange={(e) => setFogEnabled(e.target.checked)} disabled={!showLinks} />
          Distanz-Ausblendung (Kanten)
        </label>
        <label style={rowStyle}>
          Ausblendung ab ({fogNear})
          <input type="range" min={10} max={500} step={10} value={fogNear} disabled={!showLinks || !fogEnabled} onChange={(e) => setFogNear(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Unsichtbar ab ({fogFar})
          <input type="range" min={200} max={3000} step={50} value={fogFar} disabled={!showLinks || !fogEnabled} onChange={(e) => setFogFar(Number(e.target.value))} />
        </label>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          Node-Rendering
          <select
            value={useCustomNodeRender ? 'custom' : 'default'}
            onChange={(e) => setUseCustomNodeRender(e.target.value === 'custom')}
            style={inputStyle}
          >
            <option value="default">Original (Library)</option>
            <option value="custom">Custom (Sprite)</option>
          </select>
        </label>

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
