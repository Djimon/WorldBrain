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
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

// Grey-veil fix (measured live, temp/bloom-repro.html): the composer RT
// already holds sRGB-encoded values (a raw copy of a background pixel
// returns 11,13,16 unchanged). Every final blit — Bloom's renderToScreen
// as well as an appended OutputPass — encodes AGAIN: 11 -> 59,
// exactly sRGB(sRGB(x)). That's why "append an OutputPass" alone did
// nothing either. Fix: decode once (sRGB -> Linear) BEFORE Bloom computes,
// OutputPass does ToneMapping at the end + the single correct encoding.
// Decode -> Bloom(0) -> Output without ToneMapping reproduces the reference
// pixel-accurately (11,13,16); with ACES near-black becomes 1,2,3 (richer).
const SRGB_DECODE_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; varying vec2 vUv;
    vec3 srgbToLinear(vec3 c){
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
    }
    void main(){
      vec4 t = texture2D(tDiffuse, vUv);
      gl_FragColor = vec4(srgbToLinear(t.rgb), t.a);
    }`,
};

// Selective Bloom (only bubbles glow, links/paths NEVER; cores stay
// sharp) as a Photoshop stack: at the bottom the sharp base scene, on top
// the PURE glow (only the Bloom mips, without the bubble render itself), and the
// bubbles stay "on top" by punching the glow out beneath them via a mask:
// out = base + glow * (1 - bubbleMask). An earlier
// max() approach failed: the glow buffer contained the (blurred)
// bubbles themselves and was brighter at the edges than the sharp base.
const BLOOM_LAYER = 1;

const COPY_SHADER = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D tDiffuse; varying vec2 vUv; void main(){ gl_FragColor = texture2D(tDiffuse, vUv); }',
};

class BubbleLayerRenderPass extends RenderPass {
  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    // Clear with alpha 0: the buffer alpha is then exactly the rendered
    // sprite alpha — the MixPass uses it as a shape-faithful punch-out mask
    // (brightness thresholds produced dark rings at the bubble edge).
    super(scene, camera, null, new THREE.Color(0, 0, 0), 0);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number, maskActive: boolean) {
    const savedMask = this.camera.layers.mask;
    this.camera.layers.set(BLOOM_LAYER);
    super.render(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    this.camera.layers.mask = savedMask;
  }
}

class SelectiveBloomMixPass extends Pass {
  private readonly material: THREE.ShaderMaterial;
  private readonly fsQuad: FullScreenQuad;

  constructor(
    private readonly bloomComposer: EffectComposer,
    private readonly bloomPass: UnrealBloomPass,
  ) {
    super();
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tGlow: { value: null }, tBubbles: { value: null } },
      vertexShader: SRGB_DECODE_SHADER.vertexShader,
      // tGlow = PURE Bloom (only blur mips); tBubbles = sharp
      // bubbles-only render as a punch-out mask. Where a bubble is,
      // NO glow is applied -> the core stays exactly the sharp base scene.
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform sampler2D tGlow; uniform sampler2D tBubbles;
        varying vec2 vUv;
        void main(){
          vec4 base = texture2D(tDiffuse, vUv);
          vec3 glow = texture2D(tGlow, vUv).rgb;
          float mask = texture2D(tBubbles, vUv).a;
          gl_FragColor = vec4(base.rgb + glow * (1.0 - mask), base.a);
        }`,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget) {
    this.bloomComposer.render();
    this.material.uniforms.tDiffuse.value = readBuffer.texture;
    // renderTargetsHorizontal[0] holds the composite of all blur mips
    // (incl. strength/radius) BEFORE the pass blends it additively —
    // that is the pure glow without the bubbles themselves.
    this.material.uniforms.tGlow.value = this.bloomPass.renderTargetsHorizontal[0].texture;
    // Buffer choreography in the glow composer (Render->Decode->Copy->Bloom):
    // after the copy swap Bloom blends into the copy; the writeBuffer
    // then still holds the un-blurred bubbles-only render.
    this.material.uniforms.tBubbles.value = this.bloomComposer.writeBuffer.texture;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }

  dispose() {
    // EffectComposer.dispose() only cleans up its own RenderTargets,
    // not the addPass() passes — those hang off this composer and
    // have to go here too.
    for (const pass of this.bloomComposer.passes) pass.dispose();
    this.bloomComposer.dispose();
    this.material.dispose();
    this.fsQuad.dispose();
  }
}

interface SpikeNode {
  id: string;
  group: number;
  val: number; // degree-based size — hub nodes render bigger, mirrors real entity importance
  degreeNorm: number; // 0..1 (sqrt-scaled relative to the max degree) — basis for the spread slider
}

type LinkKind = 'relation' | 'mention';

interface SpikeLink {
  source: string;
  target: string;
  kind: LinkKind;
  strength: number; // 1-4, drives line thickness
}

const GROUP_COUNT = 8;
// Pastel palette after the reference images (_design/knowledgegraph-*.png):
// light blue, pink, light green, lavender, orange, yellow, salmon, sky blue.
const GROUP_COLORS = ['#6cb8f0', '#f07ad0', '#8fd97a', '#b39df5', '#f5923e', '#f2c94c', '#f0716a', '#a8cdec'];
// Reference: links are wafer-thin and almost invisible — both kinds
// greyish-subtle, distinguished only by warm (relation) vs cold (mention).
const LINK_KIND_COLOR: Record<LinkKind, string> = {
  relation: '#ffffff',
  mention: '#ff3526',
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
  const nodes: SpikeNode[] = groupOfNode.map((group, i) => {
    const degreeNorm = Math.sqrt(degree[i] / maxDegree);
    return { id: `n${i}`, group, val: 1 + degreeNorm * 6, degreeNorm };
  });

  return { nodes, links };
}

// Fake glow like in the reference mockup: a softly fading circle BENEATH the
// sphere, in the sphere's color — a second sprite per node instead of fullscreen
// post-processing. Deterministic, cheap, doesn't blow out.
let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.32)');
  gradient.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  glowTexture = new THREE.CanvasTexture(canvas);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

const glowMaterialCache = new Map<string, THREE.SpriteMaterial>();
function getGlowMaterial(color: string): THREE.SpriteMaterial {
  const cached = glowMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.SpriteMaterial({
    map: getGlowTexture(),
    color,
    transparent: true,
    // Additive: overlapping glows in clusters sum up to the soft
    // nebula like in the galaxy reference; depthWrite off so the glow
    // doesn't occlude anything.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  glowMaterialCache.set(color, material);
  return material;
}

// Reference (bubble.png = matte GREY sphere with light from above, meant
// to be tinted): that is simply a REAL, lit 3D sphere — no sprite
// trick. 3d-force-graph already ships AmbientLight(0xcccccc, PI) + directional
// light from above (0.6*PI); MeshLambert (matte, diffuse only)
// reproduces the reference shading from every angle.
// Geometry shared (diameter 1, scaled per node), material per color.
const NODE_SPHERE_GEOMETRY = new THREE.SphereGeometry(0.5, 24, 16);
const sphereMaterialCache = new Map<string, THREE.MeshLambertMaterial>();
function getSphereMaterial(color: string): THREE.MeshLambertMaterial {
  const cached = sphereMaterialCache.get(color);
  if (cached) return cached;
  const material = new THREE.MeshLambertMaterial({ color, fog: false });
  sphereMaterialCache.set(color, material);
  return material;
}

// Ego-dim variant: greyed out (lerped toward grey) + 30% opacity,
// stays clickable. Own instance per color, since materials are shared.
const sphereDimMaterialCache = new Map<string, THREE.MeshLambertMaterial>();
function getSphereDimMaterial(color: string): THREE.MeshLambertMaterial {
  const cached = sphereDimMaterialCache.get(color);
  if (cached) return cached;
  const greyed = new THREE.Color(color).lerp(new THREE.Color('#888888'), 0.6);
  const material = new THREE.MeshLambertMaterial({
    color: greyed,
    fog: false,
    transparent: true,
    opacity: 0.3,
    // no depth write: semi-transparent dimmed spheres should not punch out
    // the active ones behind them
    depthWrite: false,
  });
  sphereDimMaterialCache.set(color, material);
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
  // Encode to sRGB like the built-in materials: the composer buffer holds
  // encoded values and the decode pass linearizes EVERYTHING — a custom
  // shader without encode gets darkened twice (links turned into
  // black strokes as soon as Bloom was active).
  vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }
  void main() {
    float dist = distance(cameraPosition, vWorldPosition);
    float fade = mix(1.0, 1.0 - smoothstep(uFadeNear, uFadeFar, dist), uFadeEnabled);
    gl_FragColor = vec4(linearToSrgb(uColor), uOpacity * fade);
  }
`;

const linkFadeMaterialCache = new Map<LinkKind, THREE.ShaderMaterial>();
function getLinkFadeMaterial(kind: LinkKind): THREE.ShaderMaterial {
  const cached = linkFadeMaterialCache.get(kind);
  if (cached) return cached;
  const material = new THREE.ShaderMaterial({
    // Initial values = UI defaults (fogEnabled true, 270/1950, opacity 0.25):
    // otherwise the first frame renders with wrong values until the sync
    // effect fires — fade only took effect after toggling off/on once.
    uniforms: {
      uColor: { value: new THREE.Color(LINK_KIND_COLOR[kind]) },
      uOpacity: { value: 0.25 },
      uFadeNear: { value: 270 },
      uFadeFar: { value: 1950 },
      uFadeEnabled: { value: 1 },
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
  const bloomPassesRef = useRef<Pass[]>([]);

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

  const [nodeCount, setNodeCount] = useState(1000);
  const [linkCount, setLinkCount] = useState(2500);
  const [genKey, setGenKey] = useState(0);
  const [dims, setDims] = useState<1 | 2 | 3>(3);

  // The earlier "grey veil as soon as Bloom is active" is FIXED — the cause was
  // double sRGB encoding, see SRGB_DECODE_SHADER above. NOTE: Bloom
  // now computes on LINEAR values, so threshold/strength behave
  // differently than before — re-tune if needed.
  //
  // Selective Bloom is now IMPLEMENTED (BubbleLayerRenderPass +
  // SelectiveBloomMixPass above): the two-composer setup once thought
  // necessary can be run after all, by driving the own glow composer from a
  // custom pass INSIDE the library composer. Only the
  // sprites are on BLOOM_LAYER — links/paths never glow. Applies only in
  // custom node rendering; the library spheres (original mode) don't have the
  // layer and get no glow.
  // Defaults calibrated to LINEAR values (decode fix): in linear everything is
  // darker than sRGB (0.5 -> 0.21), so strength is higher than before.
  // Threshold 0: the cut compares LUMINANCE (G ~0.71, R ~0.21, B ~0.07),
  // so each group color kicks in at a different value — at 0 everything
  // glows proportional to its own brightness, the background (~0) stays
  // black. Dosage via strength/radius.
  // Fake glow (reference approach): a soft color circle per node BENEATH the sphere
  // — default glow instead of Bloom post-processing. Bloom stays as an A/B option.
  const [glowEnabled, setGlowEnabled] = useState(true);
  const [glowScale, setGlowScale] = useState(2.8);
  const [glowOpacity, setGlowOpacity] = useState(0.75);
  const [bloomEnabled, setBloomEnabled] = useState(true);
  const [bloomStrength, setBloomStrength] = useState(0.5);
  const [bloomRadius, setBloomRadius] = useState(0.85);
  const [bloomThreshold, setBloomThreshold] = useState(0);
  // Default NO ToneMapping: decode+encode cancel out exactly, so Bloom-on
  // is color-identical to Bloom-off (reference colors stay 1:1) — ACES
  // visibly pushed the pastel colors down ("multiply look"). The compressors
  // remain in the select for A/B.
  const [toneMappingMode, setToneMappingMode] = useState<'neutral' | 'aces' | 'reinhard' | 'none'>('neutral');
  const [showLinks, setShowLinks] = useState(true);
  // PERF NOTE: curved links (>0) force per-link curve geometry instead of
  // plain THREE.Line — tanked fps at 15k links (live-confirmed).
  // 0.15 is the look-tuned default; set to 0 for large datasets.
  const [linkCurvature, setLinkCurvature] = useState(0.15);
  // Reference: links barely visible — structure comes from the dots.
  const [linkOpacity, setLinkOpacity] = useState(1.0);
  const [relationColor, setRelationColor] = useState(LINK_KIND_COLOR.relation);
  const [mentionColor, setMentionColor] = useState(LINK_KIND_COLOR.mention);
  // Real distance-based alpha fade for links (getLinkFadeMaterial's shader)
  // — replaces an earlier attempt using THREE.Fog, which only blends color
  // toward the fog color and never touches alpha, so it faded to a harsh
  // near-black tint instead of actually disappearing.
  const [fogEnabled, setFogEnabled] = useState(true);
  const [fogNear, setFogNear] = useState(180);
  const [fogFar, setFogFar] = useState(850);
  // Lets you A/B the library's own default node rendering (real lit 3D
  // spheres via nodeAutoColorBy) against the hand-tuned sprite rendering
  // below, live, instead of guessing blind at which one you actually want.
  const [useCustomNodeRender, setUseCustomNodeRender] = useState(true);
  // Headlight direction camera-local, rotatable via slider. 0/0 = exactly behind
  // the viewer; horizontal rotates around the vertical axis, vertical raises/lowers.
  const [lightAzimuth, setLightAzimuth] = useState(0);
  const [lightElevation, setLightElevation] = useState(0);

  const [fps, setFps] = useState(0);
  const [engineStopMs, setEngineStopMs] = useState<number | null>(null);
  const warmupStartRef = useRef(0);

  // genKey forces a fresh dataset when "Neu generieren" is clicked, even if
  // node/link counts are unchanged.
  const graphData = useMemo(() => generateGraph(nodeCount, linkCount), [nodeCount, linkCount, genKey]);

  // Size spread: factor between the smallest (degree 0) and largest
  // sphere (max degree). 0 = all the same size; 6 = previous behavior.
  const [sizeSpread, setSizeSpread] = useState(25);

  // Ego view: click a sphere -> only it + neighbors + their links.
  // dim = the rest greyed out/30% (stays clickable), hide = the rest completely gone.
  const [egoNodeId, setEgoNodeId] = useState<string | null>(null);
  const [egoMode, setEgoMode] = useState<'dim' | 'hide'>('dim');
  // Ego state as a ref: nodeThreeObject reads it on EVERY (re)build of the
  // node objects — the lib rebuilds after prop changes and would immediately
  // overwrite a purely imperative material swap again (dim was
  // visible for only 1 frame).
  const egoStateRef = useRef<{ id: string | null; mode: 'dim' | 'hide'; neighbors: Set<string> | null }>(
    { id: null, mode: 'dim', neighbors: null },
  );
  // Adjacency from the fresh data (source/target are still the
  // string IDs here; the force engine replaces them with node objects later).
  const neighborsOf = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const link of graphData.links) {
      if (!map.has(link.source)) map.set(link.source, new Set());
      if (!map.has(link.target)) map.set(link.target, new Set());
      map.get(link.source)!.add(link.target);
      map.get(link.target)!.add(link.source);
    }
    return map;
  }, [graphData]);
  // After the engine start, link.source/target are node objects.
  const endpointId = (end: string | NodeObject<SpikeNode>): string =>
    typeof end === 'string' ? end : end.id;
  // Updated in the render body so the ref is guaranteed fresh BEFORE the
  // lib's next object (re)build.
  egoStateRef.current = {
    id: egoNodeId,
    mode: egoMode,
    neighbors: egoNodeId ? neighborsOf.get(egoNodeId) ?? null : null,
  };

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
    // dispose(): UnrealBloomPass holds its own RenderTargets — without dispose
    // every slider/resize pass leaks GPU memory.
    for (const pass of bloomPassesRef.current) {
      composer.removePass(pass);
      pass.dispose();
    }
    bloomPassesRef.current = [];
    // UnrealBloomPass's own source (three/examples/jsm/postprocessing/
    // UnrealBloomPass.js) states directly in its JSDoc: "When using this
    // pass, tone mapping must be enabled in the renderer settings." This
    // renderer defaults to NoToneMapping (3d-force-graph never sets it,
    // since it wasn't built assuming bloom would be added) — a documented
    // requirement this was missing entirely, not a guess.
    // OutputPass reads renderer.toneMapping per frame — switching takes effect live.
    const TONE_MAPPINGS = {
      neutral: THREE.NeutralToneMapping,
      aces: THREE.ACESFilmicToneMapping,
      reinhard: THREE.ReinhardToneMapping,
      none: THREE.NoToneMapping,
    } as const;
    renderer.toneMapping = bloomEnabled ? TONE_MAPPINGS[toneMappingMode] : THREE.NoToneMapping;
    if (bloomEnabled) {
      // window.innerWidth/innerHeight are CSS pixels; the actual WebGL
      // drawing buffer is that times devicePixelRatio. Passing the CSS size
      // as the bloom pass's resolution left its internal render targets
      // smaller than the real canvas whenever devicePixelRatio > 1 (e.g.
      // Windows display scaling), which showed up as a hard-edged grey
      // rectangle covering only part of the screen once bloom was enabled.
      const size = renderer.getSize(new THREE.Vector2());
      const pixelRatio = renderer.getPixelRatio();
      // Chain against the grey veil (derivation at SRGB_DECODE_SHADER):
      // Decode (RT -> linear), Bloom computes linear, OutputPass does
      // ToneMapping + the single final sRGB encoding.
      // Glow branch (derivation at BLOOM_LAYER): renders ONLY the bubbles
      // (camera on the bloom layer), decodes, blooms. renderToScreen false —
      // the result is picked up by the MixPass in the main composer.
      // Take the lights onto the bloom layer too: the glow branch renders with
      // the camera ONLY on BLOOM_LAYER — otherwise the Lambert spheres would be
      // unlit there (= black) and Bloom would have no source.
      fg.lights().forEach((light) => light.layers.enable(BLOOM_LAYER));
      const bloomComposer = new EffectComposer(renderer);
      bloomComposer.renderToScreen = false;
      bloomComposer.setSize(size.x, size.y);
      const glowBloomPass = new UnrealBloomPass(
        new THREE.Vector2(size.x * pixelRatio, size.y * pixelRatio),
        bloomStrength, bloomRadius, bloomThreshold,
      );
      bloomComposer.addPass(new BubbleLayerRenderPass(fg.scene(), fg.camera()));
      bloomComposer.addPass(new ShaderPass(SRGB_DECODE_SHADER));
      // Copy before Bloom: sacrifices one blit so the sharp bubbles-only
      // render survives the Bloom blend (punch-out mask in the MixPass).
      bloomComposer.addPass(new ShaderPass(COPY_SHADER));
      bloomComposer.addPass(glowBloomPass);
      const passes: Pass[] = [
        new ShaderPass(SRGB_DECODE_SHADER),
        new SelectiveBloomMixPass(bloomComposer, glowBloomPass),
        new OutputPass(),
      ];
      for (const pass of passes) composer.addPass(pass);
      bloomPassesRef.current = passes;
    }
  }, [bloomEnabled, bloomStrength, bloomRadius, bloomThreshold, toneMappingMode, genKey, useCustomNodeRender, viewportSize]);

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

  // Push the glow opacity into the cached (per-color shared) materials.
  useEffect(() => {
    for (const material of glowMaterialCache.values()) material.opacity = glowOpacity;
  }, [glowOpacity]);

  // Ego dim: grey out non-neighbors instead of hiding — material swap on
  // the existing node objects (no rebuild), glow sprite off in the process.
  // Only in custom rendering (library spheres have their own materials).
  useEffect(() => {
    if (!useCustomNodeRender) return;
    const neighbors = egoNodeId ? neighborsOf.get(egoNodeId) : null;
    for (const node of graphData.nodes as (SpikeNode & { __threeObj?: THREE.Group })[]) {
      const obj = node.__threeObj;
      if (!obj) continue;
      const active = !egoNodeId || node.id === egoNodeId || (neighbors?.has(node.id) ?? false);
      const dimmed = egoMode === 'dim' && !active;
      const color = GROUP_COLORS[node.group % GROUP_COLORS.length];
      for (const child of obj.children) {
        if ((child as THREE.Mesh).isMesh) {
          (child as THREE.Mesh).material = dimmed ? getSphereDimMaterial(color) : getSphereMaterial(color);
        } else if ((child as THREE.Sprite).isSprite) {
          child.visible = !dimmed;
        }
      }
    }
  }, [egoNodeId, egoMode, useCustomNodeRender, graphData, neighborsOf]);

  // Headlight: the lib's DirectionalLight sits fixed in world space — when
  // orbiting you look at unlit back sides. Light AND target parented to
  // the camera = sun at the viewer; direction via slider.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const applyHeadlight = () => {
      const camera = fg.camera();
      const dirLight = fg.lights().find(
        (l): l is THREE.DirectionalLight => (l as THREE.DirectionalLight).isDirectionalLight,
      );
      if (!dirLight) return;
      if (dirLight.parent !== camera) {
        // The camera must be in the scene graph, otherwise its children don't render.
        fg.scene().add(camera);
        camera.add(dirLight);
        camera.add(dirLight.target);
      }
      // Camera-local: +z = behind the viewer, -z = viewing direction.
      // Az/El 0/0 = light exactly behind the camera, aiming through it.
      const az = THREE.MathUtils.degToRad(lightAzimuth);
      const el = THREE.MathUtils.degToRad(lightElevation);
      const x = Math.sin(az) * Math.cos(el);
      const y = Math.sin(el);
      const z = Math.cos(az) * Math.cos(el);
      dirLight.position.set(x, y, z);
      dirLight.target.position.set(-x, -y, -z);
    };

    applyHeadlight();
    // The lib applies its lights property with a delay (Kapsule digest)
    // and reparents the light back into the scene in the process — the headlight
    // therefore sat wrong at startup, until a slider move re-fired the effect.
    // The guard reclaims it as soon as it was stolen.
    const guard = setInterval(() => {
      const camera = fg.camera();
      const dirLight = fg.lights().find(
        (l): l is THREE.DirectionalLight => (l as THREE.DirectionalLight).isDirectionalLight,
      );
      if (dirLight && dirLight.parent !== camera) applyHeadlight();
    }, 250);
    return () => clearInterval(guard);
  }, [useCustomNodeRender, lightAzimuth, lightElevation]);

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
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#37265a' }}>
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
        nodeVal={(n: NodeObject<SpikeNode>) => Math.pow(1 + sizeSpread, n.degreeNorm - 0.5)}
        nodeLabel={(n: NodeObject<SpikeNode>) => `${n.id} (Gruppe ${n.group})`}
        nodeAutoColorBy={useCustomNodeRender ? undefined : 'group'}
        nodeThreeObject={useCustomNodeRender ? (n: NodeObject<SpikeNode>) => {
          const color = GROUP_COLORS[n.group % GROUP_COLORS.length];
          // Apply ego dim directly at object build time — the lib rebuilds the
          // objects after prop changes, so a later swap
          // alone gets overwritten.
          const ego = egoStateRef.current;
          const active = !ego.id || n.id === ego.id || (ego.neighbors?.has(n.id) ?? false);
          const dimmed = ego.mode === 'dim' && ego.id !== null && !active;
          const group = new THREE.Group();
          // Spread symmetric around the fixed mid-size 10: small
          // spheres shrink, large ones grow. Ratio smallest:largest =
          // 1:(1+spread); spread 0 = all the same size.
          const coreSize = 10 * Math.pow(1 + sizeSpread, n.degreeNorm - 0.5);
          if (glowEnabled && !dimmed) {
            const glow = new THREE.Sprite(getGlowMaterial(color));
            glow.scale.set(coreSize * glowScale, coreSize * glowScale, 1);
            // renderOrder: glow first, sphere opaque on top.
            glow.renderOrder = 1;
            group.add(glow);
          }
          // Real lit sphere (reference look), shared geometry.
          const core = new THREE.Mesh(NODE_SPHERE_GEOMETRY, dimmed ? getSphereDimMaterial(color) : getSphereMaterial(color));
          core.scale.setScalar(coreSize);
          core.renderOrder = 2;
          // Layer 0 stays ON (main render), the bloom layer is added —
          // only what's here goes into the (optional) bloom glow branch.
          core.layers.enable(BLOOM_LAYER);
          group.add(core);
          return group;
        } : undefined}
        nodeThreeObjectExtend={false}
        nodeVisibility={(n: NodeObject<SpikeNode>) =>
          egoMode === 'dim' || !egoNodeId || n.id === egoNodeId || (neighborsOf.get(egoNodeId)?.has(n.id) ?? false)}
        linkVisibility={(l: LinkObject<SpikeNode, SpikeLink>) =>
          showLinks && (!egoNodeId || endpointId(l.source) === egoNodeId || endpointId(l.target) === egoNodeId)}
        linkMaterial={(l: LinkObject<SpikeNode, SpikeLink>) => getLinkFadeMaterial(l.kind)}
        linkCurvature={linkCurvature}
        cooldownTicks={100}
        onNodeClick={(n: NodeObject<SpikeNode>) => setEgoNodeId((prev) => (prev === n.id ? null : n.id))}
        onBackgroundClick={() => setEgoNodeId(null)}
        onEngineStop={() => setEngineStopMs(Math.round(performance.now() - warmupStartRef.current))}
        enableNavigationControls
        showNavInfo={false}
        backgroundColor="#37265a"
      />
      <div style={panelStyle}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>#320 Graph-Spike — Live-Messwerte</div>
        <div>fps: <b style={{ color: fps >= 45 ? '#4caf50' : fps >= 25 ? '#e0a53f' : '#e05353' }}>{fps}</b></div>
        <div>Nodes: {graphData.nodes.length.toLocaleString('de-DE')} · Links: {graphData.links.length.toLocaleString('de-DE')}</div>
        <div>Force-Sim Konvergenz: {engineStopMs === null ? 'läuft…' : `${engineStopMs} ms`}</div>
        {egoNodeId && (
          <div>Ego-View: <b>{egoNodeId}</b> ({neighborsOf.get(egoNodeId)?.size ?? 0} Nachbarn) — Klick auf Hintergrund = alles</div>
        )}

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
        <label style={rowStyle}>
          Groessen-Spread ({sizeSpread.toFixed(1)})
          <input type="range" min={0} max={30} step={0.5} value={sizeSpread} onChange={(e) => setSizeSpread(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Ego-Modus
          <select value={egoMode} onChange={(e) => setEgoMode(e.target.value as 'dim' | 'hide')} style={inputStyle}>
            <option value="dim">Abdunkeln (klickbar)</option>
            <option value="hide">Ausblenden</option>
          </select>
        </label>

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
          Licht horizontal ({lightAzimuth}°)
          <input type="range" min={-180} max={180} step={5} value={lightAzimuth} onChange={(e) => setLightAzimuth(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Licht vertikal ({lightElevation}°)
          <input type="range" min={-90} max={90} step={5} value={lightElevation} onChange={(e) => setLightElevation(Number(e.target.value))} />
        </label>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          <input type="checkbox" checked={glowEnabled} onChange={(e) => setGlowEnabled(e.target.checked)} />
          Node-Glow (Sprite)
        </label>
        <label style={rowStyle}>
          Glow-Groesse ({glowScale.toFixed(1)}x)
          <input type="range" min={1.2} max={6} step={0.2} value={glowScale} disabled={!glowEnabled} onChange={(e) => setGlowScale(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Glow-Deckkraft ({glowOpacity.toFixed(2)})
          <input type="range" min={0.1} max={1} step={0.05} value={glowOpacity} disabled={!glowEnabled} onChange={(e) => setGlowOpacity(Number(e.target.value))} />
        </label>

        <hr style={hrStyle} />

        <label style={rowStyle}>
          <input type="checkbox" checked={bloomEnabled} onChange={(e) => setBloomEnabled(e.target.checked)} />
          Bloom aktiv (Post-FX, A/B)
        </label>
        <label style={rowStyle}>
          Strength ({bloomStrength.toFixed(2)})
          <input type="range" min={0} max={8} step={0.1} value={bloomStrength} disabled={!bloomEnabled} onChange={(e) => setBloomStrength(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Radius ({bloomRadius.toFixed(2)})
          <input type="range" min={0} max={1} step={0.05} value={bloomRadius} disabled={!bloomEnabled} onChange={(e) => setBloomRadius(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          Threshold ({bloomThreshold.toFixed(2)})
          <input type="range" min={0} max={1} step={0.05} value={bloomThreshold} disabled={!bloomEnabled} onChange={(e) => setBloomThreshold(Number(e.target.value))} />
        </label>
        <label style={rowStyle}>
          ToneMapping
          <select
            value={toneMappingMode}
            disabled={!bloomEnabled}
            onChange={(e) => setToneMappingMode(e.target.value as 'neutral' | 'aces' | 'reinhard' | 'none')}
            style={inputStyle}
          >
            <option value="neutral">Neutral (Glow bleibt)</option>
            <option value="aces">ACES (filmisch, dunkelt)</option>
            <option value="reinhard">Reinhard (weich)</option>
            <option value="none">Keins (Clipping)</option>
          </select>
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
