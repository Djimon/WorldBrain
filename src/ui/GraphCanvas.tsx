// M16-S03 (#324) — the ONE renderer core for every graph view (D12): global
// (this story), Galaxy (S04), Ring (S05), Ego (S07) are all THIS component
// with a different {nodes, links} slice + layout config. No graph "kind"
// branches here; the caller decides what to render.
//
// Renderer = three.js (raw), decided in the open bench #326. NOT
// react-force-graph-3d (Kapsule workarounds, #320).
//
// LIVE-APPLY architecture: the scene + camera + renderer are built ONCE (only
// nodes/positions/layout/look force a rebuild). Everything a settings panel can
// toggle — colors, node sizes, edge visibility/form/width, glow — is applied
// IMPERATIVELY by secondary effects, so toggling a setting never remounts the
// scene and never resets the camera.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { GraphLink, GraphNode } from '../services/graph-model';
import type { EdgeVisualStyle, NodeVisualStyle } from '../services/graph-style';
import { computeGalaxyLayout3D } from '../services/galaxy-layout';

export interface GraphLayoutConfig {
  mode: 'force' | 'galaxy' | 'ring';
  clusterStrength?: number;
  chargeStrength?: number;
  linkDistance?: number;
  spreadScale?: number;
}

export interface GraphLookConfig {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  radiusScale: number;
  lightAzimuth: number;
  lightElevation: number;
  lightIntensity: number;
  ambientIntensity: number;
  dimFactor: number;
  fit: number;
  camDistanceFactor: number;
  edgeWidthScale: number;
  edgeOpacityScale: number;
}

// Tuned in the look harness (#324, 2026-08-07) — the final production look.
export const DEFAULT_LOOK: GraphLookConfig = {
  bloomStrength: 0.5,
  bloomRadius: 0.75,
  bloomThreshold: 0,
  radiusScale: 0.4,
  lightAzimuth: Math.atan2(-0.4, 1),
  lightElevation: Math.atan2(0.4, Math.hypot(-0.4, 1)),
  lightIntensity: 1.4,
  ambientIntensity: 0.55,
  dimFactor: 0.2,
  fit: 425,
  camDistanceFactor: 2.7,
  edgeWidthScale: 0.3,
  edgeOpacityScale: 0.6,
};

export interface GraphPosition { id: string; x: number; y: number; z: number; }
export type EdgeForm = 'solid' | 'dashed' | 'animated';

export interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeStyle: (node: GraphNode) => NodeVisualStyle;
  edgeStyle: (link: GraphLink) => EdgeVisualStyle;
  layout?: GraphLayoutConfig;
  positions?: GraphPosition[];
  look?: Partial<GraphLookConfig>;
  glowEnabled?: boolean;
  nodeSizeScale?: number;
  edgesHidden?: boolean;
  edgeRevealDepth?: number;
  relationForm?: EdgeForm;
  mentionForm?: EdgeForm;
  onNavigate: (id: string) => void;
  onHoverNode?: (id: string | null) => void;
}

const FALLBACK_W = 800;
const FALLBACK_H = 600;
const EDGE_MIN_PX = 1;   // floor so edges never render sub-pixel (invisible)
const DASH_SIZE = 10;
const GAP_SIZE = 8;
const ANIM_SPEED = 0.6;

const MIX_SHADER = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D baseTexture; uniform sampler2D bloomTexture;
    void main(){ gl_FragColor = texture2D(baseTexture,vUv) + texture2D(bloomTexture,vUv); }
  `,
};

interface GraphState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  mesh: THREE.InstancedMesh;
  worldById: Map<string, THREE.Vector3>;
  baseColors: THREE.Color[];
  neighbors: Map<string, Set<string>>;
  revealGroup: THREE.Group;
  revealKids: LineSegments2[];
  fullLines: LineSegments2[];
  lineMaterials: Set<LineMaterial>;
  composers: { bloom: EffectComposer; final: EffectComposer } | null;
  buildFatLines: (subset: GraphLink[], kind: 'relation' | 'mention') => LineSegments2 | null;
  rebuildEdges: () => void;
  rebuildReveal: (focusId: string | null) => void;
  applyColorsAndSizes: () => void;
  L: GraphLookConfig;
  width: number;
  height: number;
  hoveredId: string | null;
  pinnedId: string | null;
  disposed: boolean;
}

export function GraphCanvas(props: GraphCanvasProps): React.ReactElement {
  const {
    nodes, links, positions, look, layout, glowEnabled,
    edgesHidden, edgeRevealDepth, relationForm, mentionForm, nodeStyle, edgeStyle, nodeSizeScale,
  } = props;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gRef = useRef<GraphState | null>(null);

  // latest props for imperative reads (handlers/build read these, so they are
  // not effect deps and don't force a rebuild).
  const p = useRef(props);
  p.current = props;

  const lookKey = JSON.stringify(look ?? {});
  const posKey = positions ? `p${positions.length}` : 'auto';
  const layoutKey = `${layout?.mode}|${layout?.clusterStrength}|${layout?.chargeStrength}|${layout?.linkDistance}|${layout?.spreadScale}`;

  // ── build once (rebuild only on data/layout/look) ─────────────────────────
  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const L: GraphLookConfig = { ...DEFAULT_LOOK, ...p.current.look };
    const width = mountEl.clientWidth || FALLBACK_W;
    const height = mountEl.clientHeight || FALLBACK_H;
    const spreadScale = p.current.layout?.spreadScale ?? 1.0;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 20000);
    camera.position.set(0, 0, L.fit * L.camDistanceFactor);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mountEl.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, L.ambientIntensity));
    const headlight = new THREE.DirectionalLight(0xffffff, L.lightIntensity);
    headlight.position.set(
      Math.sin(L.lightAzimuth) * Math.cos(L.lightElevation),
      Math.sin(L.lightElevation),
      Math.cos(L.lightAzimuth) * Math.cos(L.lightElevation),
    );
    camera.add(headlight);
    camera.add(headlight.target);
    scene.add(camera);

    const positioned: GraphPosition[] = p.current.positions ?? computeGalaxyLayout3D(nodes, links, {
      clusterStrength: p.current.layout?.clusterStrength,
      chargeStrength: p.current.layout?.chargeStrength,
      linkDistance: p.current.layout?.linkDistance,
    });
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (const q of positioned) {
      if (q.x < xMin) xMin = q.x; if (q.x > xMax) xMax = q.x;
      if (q.y < yMin) yMin = q.y; if (q.y > yMax) yMax = q.y;
      if (q.z < zMin) zMin = q.z; if (q.z > zMax) zMax = q.z;
    }
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2, cz = (zMin + zMax) / 2;
    const extent = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) || 1;
    const norm = ((2 * L.fit) / extent) * spreadScale;
    const worldById = new Map<string, THREE.Vector3>();
    for (const q of positioned) {
      worldById.set(q.id, new THREE.Vector3((q.x - cx) * norm, (q.y - cy) * norm, (q.z - cz) * norm));
    }

    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, nodes.length);
    scene.add(mesh);

    const revealGroup = new THREE.Group();
    scene.add(revealGroup);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const state: GraphState = {
      scene, camera, renderer, controls, mesh, worldById,
      baseColors: [], neighbors: new Map(), revealGroup, revealKids: [], fullLines: [],
      lineMaterials: new Set(), composers: null,
      buildFatLines: () => null, rebuildEdges: () => {}, rebuildReveal: () => {}, applyColorsAndSizes: () => {},
      L, width, height, hoveredId: null, pinnedId: null, disposed: false,
    };
    gRef.current = state;

    // colors + per-instance scale (called from the size/color effect too)
    state.applyColorsAndSizes = () => {
      const dummy = new THREE.Object3D();
      const cur = p.current;
      const sizeScale = cur.nodeSizeScale ?? 1.0;
      state.baseColors = [];
      nodes.forEach((n, i) => {
        const w = worldById.get(n.id);
        const style = cur.nodeStyle(n);
        dummy.position.copy(w ?? new THREE.Vector3());
        dummy.scale.setScalar(Math.max(0.001, style.radius * L.radiusScale * sizeScale));
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        const c = new THREE.Color(style.color);
        state.baseColors.push(c);
        mesh.setColorAt(i, c);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    };

    state.buildFatLines = (subset, kind) => {
      const cur = p.current;
      const style = cur.edgeStyle({ source: '', target: '', kind });
      const form = kind === 'relation' ? (cur.relationForm ?? 'solid') : (cur.mentionForm ?? 'solid');
      const pts: number[] = [];
      for (const l of subset) {
        if (l.kind !== kind) continue;
        const a = worldById.get(l.source), b = worldById.get(l.target);
        if (!a || !b) continue;
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      if (pts.length === 0) return null;
      const g = new LineSegmentsGeometry();
      g.setPositions(pts);
      const dashed = form !== 'solid';
      const m = new LineMaterial({
        color: style.color,
        linewidth: Math.max(EDGE_MIN_PX, style.width * L.edgeWidthScale),
        transparent: true,
        opacity: Math.min(1, style.alpha * L.edgeOpacityScale),
        dashed,
        dashSize: DASH_SIZE,
        gapSize: GAP_SIZE,
      });
      m.resolution.set(width, height);
      m.userData = { animated: form === 'animated' };
      const seg = new LineSegments2(g, m);
      if (dashed) seg.computeLineDistances();
      state.lineMaterials.add(m);
      return seg;
    };

    state.rebuildReveal = (focusId) => {
      for (const s of state.revealKids) {
        revealGroup.remove(s);
        s.geometry.dispose();
        state.lineMaterials.delete(s.material as LineMaterial);
        (s.material as THREE.Material).dispose();
      }
      state.revealKids = [];
      const cur = p.current;
      if (!cur.edgesHidden || !focusId) return;
      const depth = Math.max(1, cur.edgeRevealDepth ?? 1);
      const seen = new Set<string>([focusId]);
      let frontier = [focusId];
      for (let d = 0; d < depth; d++) {
        const next: string[] = [];
        for (const f of frontier) for (const nb of state.neighbors.get(f) ?? []) {
          if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
        }
        frontier = next;
      }
      const subset = cur.links.filter((l) => seen.has(l.source) && seen.has(l.target));
      for (const kind of ['relation', 'mention'] as const) {
        const seg = state.buildFatLines(subset, kind);
        if (seg) { revealGroup.add(seg); state.revealKids.push(seg); }
      }
    };

    state.rebuildEdges = () => {
      for (const s of state.fullLines) {
        scene.remove(s);
        s.geometry.dispose();
        state.lineMaterials.delete(s.material as LineMaterial);
        (s.material as THREE.Material).dispose();
      }
      state.fullLines = [];
      const cur = p.current;
      state.neighbors = new Map();
      for (const l of cur.links) {
        (state.neighbors.get(l.source) ?? state.neighbors.set(l.source, new Set()).get(l.source)!).add(l.target);
        (state.neighbors.get(l.target) ?? state.neighbors.set(l.target, new Set()).get(l.target)!).add(l.source);
      }
      const hide = !!cur.edgesHidden;
      for (const kind of ['relation', 'mention'] as const) {
        const seg = state.buildFatLines(cur.links, kind);
        if (seg) { seg.visible = !hide; scene.add(seg); state.fullLines.push(seg); }
      }
      state.rebuildReveal(state.pinnedId ?? state.hoveredId);
    };

    // ── interaction ──
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    function pickId(ev: PointerEvent): string | null {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(mesh);
      const id = hits.length > 0 && hits[0].instanceId != null ? nodes[hits[0].instanceId]?.id : undefined;
      return id ?? null;
    }
    function applyHoverDim(id: string | null) {
      const keep = id ? (state.neighbors.get(id) ?? new Set<string>()) : null;
      nodes.forEach((n, i) => {
        const full = !keep || n.id === id || keep.has(n.id);
        const base = state.baseColors[i];
        if (!base) return;
        mesh.setColorAt(i, full ? base : new THREE.Color(base.r * L.dimFactor, base.g * L.dimFactor, base.b * L.dimFactor));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    function onMove(ev: PointerEvent) {
      const id = pickId(ev);
      if (id === state.hoveredId) return;
      state.hoveredId = id;
      applyHoverDim(id ?? state.pinnedId);
      state.rebuildReveal(id ?? state.pinnedId);
      p.current.onHoverNode?.(id);
    }
    let downX = 0, downY = 0;
    function onDown(ev: PointerEvent) { downX = ev.clientX; downY = ev.clientY; }
    function onUp(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) return;
      const id = pickId(ev);
      state.pinnedId = id;
      applyHoverDim(id);
      state.rebuildReveal(id);
      if (id) p.current.onNavigate(id);
    }
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    let raf = 0;
    function frame() {
      if (state.disposed) return;
      controls.update();
      for (const m of state.lineMaterials) if (m.userData?.animated) m.dashOffset -= ANIM_SPEED;
      if (state.composers) {
        const vis = state.fullLines.map((s) => s.visible);
        const gv = revealGroup.visible;
        for (const s of state.fullLines) s.visible = false;
        revealGroup.visible = false;
        state.composers.bloom.render();
        state.fullLines.forEach((s, i) => { s.visible = vis[i]; });
        revealGroup.visible = gv;
        state.composers.final.render();
      } else {
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(frame);
    }

    // initial fill
    state.applyColorsAndSizes();
    state.rebuildEdges();
    raf = requestAnimationFrame(frame);

    return () => {
      state.disposed = true;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      state.composers?.bloom.dispose();
      state.composers?.final.dispose();
      for (const s of [...state.fullLines, ...state.revealKids]) {
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      }
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      gRef.current = null;
    };
  }, [nodes, posKey, layoutKey, lookKey]);

  // ── live: colors + sizes ──
  useEffect(() => {
    gRef.current?.applyColorsAndSizes();
  }, [nodeStyle, nodeSizeScale, lookKey]);

  // ── live: edges (visibility / form / color / width / topology) ──
  useEffect(() => {
    gRef.current?.rebuildEdges();
  }, [links, edgeStyle, relationForm, mentionForm, edgesHidden, edgeRevealDepth, lookKey]);

  // ── live: glow on/off ──
  useEffect(() => {
    const g = gRef.current;
    if (!g) return;
    g.composers?.bloom.dispose();
    g.composers?.final.dispose();
    g.composers = null;
    if (glowEnabled) {
      const L = g.L;
      const bloom = new EffectComposer(g.renderer);
      bloom.renderToScreen = false;
      bloom.addPass(new RenderPass(g.scene, g.camera));
      bloom.addPass(new UnrealBloomPass(new THREE.Vector2(g.width, g.height), L.bloomStrength, L.bloomRadius, L.bloomThreshold));
      const final = new EffectComposer(g.renderer);
      final.addPass(new RenderPass(g.scene, g.camera));
      const mixPass = new ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: { baseTexture: { value: null }, bloomTexture: { value: bloom.renderTarget2.texture } },
          vertexShader: MIX_SHADER.vertexShader,
          fragmentShader: MIX_SHADER.fragmentShader,
        }),
        'baseTexture',
      );
      mixPass.needsSwap = true;
      final.addPass(mixPass);
      final.addPass(new OutputPass());
      g.composers = { bloom, final };
    }
  }, [glowEnabled, lookKey]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default GraphCanvas;
