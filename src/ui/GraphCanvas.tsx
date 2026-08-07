// M16-S03 (#324) — the ONE renderer core for every graph view (D12): global
// (this story), Galaxy (S04), Ring (S05), Ego (S07) are all THIS component
// with a different {nodes, links} slice + layout config. No graph "kind"
// branches here; the caller decides what to render.
//
// Renderer = three.js (raw), decided in the open bench #326 (real GPU-3D beat
// Pixi/Sigma on look). NOT react-force-graph-3d (Kapsule deferred-digest
// workarounds, see #320). Recipe ported from the bench threeAdapter:
//   - nodes: ONE InstancedMesh (per-instance color+scale) -> few draw calls
//   - edges: TWO fat LineSegments2 (relation/mention), real px width
//   - camera headlight, OrbitControls (rotate/pan/zoom)
//   - SELECTIVE bloom (nodes only, never edges) when glowEnabled (D2, off default)
//   - click/hover via Raycaster on the InstancedMesh
//   - optional: hide edges, reveal only the n-hop neighborhood on hover/click
// Layout is 3D (computeGalaxyLayout3D); a caller may pass precomputed
// `positions` to skip the force sim (look-tuning harness, later S10 #327).
// Look knobs live in `look` (GraphLookConfig); DEFAULT_LOOK = production look.
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

// Every hardcoded look value, tunable. Defaults ARE the production look.
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

export const DEFAULT_LOOK: GraphLookConfig = {
  bloomStrength: 0.7,
  bloomRadius: 0.85,
  bloomThreshold: 0,
  radiusScale: 0.6,
  lightAzimuth: Math.atan2(-0.4, 1),
  lightElevation: Math.atan2(0.4, Math.hypot(-0.4, 1)),
  lightIntensity: 1.4,
  ambientIntensity: 0.55,
  dimFactor: 0.22,
  fit: 600,
  camDistanceFactor: 2.4,
  edgeWidthScale: 1,
  edgeOpacityScale: 1,
};

export interface GraphPosition { id: string; x: number; y: number; z: number; }

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
  // Hide all edges; reveal only the hovered/clicked node's n-hop neighborhood.
  edgesHidden?: boolean;
  edgeRevealDepth?: number; // BFS hops (default 1)
  onNavigate: (id: string) => void;
  onHoverNode?: (id: string | null) => void;
}

const FALLBACK_W = 800;
const FALLBACK_H = 600;

// additive mix of base scene + bloom-of-nodes (selective bloom).
const MIX_SHADER = {
  uniforms: { baseTexture: { value: null as THREE.Texture | null }, bloomTexture: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D baseTexture; uniform sampler2D bloomTexture;
    void main(){ gl_FragColor = texture2D(baseTexture,vUv) + texture2D(bloomTexture,vUv); }
  `,
};

export function GraphCanvas({
  nodes, links, nodeStyle, edgeStyle, layout, positions, look, glowEnabled, nodeSizeScale,
  edgesHidden, edgeRevealDepth, onNavigate, onHoverNode,
}: GraphCanvasProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const lookKey = JSON.stringify(look ?? {});
  const posKey = positions ? `p${positions.length}` : 'auto';

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    const L: GraphLookConfig = { ...DEFAULT_LOOK, ...look };
    const width = mountEl.clientWidth || FALLBACK_W;
    const height = mountEl.clientHeight || FALLBACK_H;
    const sizeScale = nodeSizeScale ?? 1.0;
    const spreadScale = layout?.spreadScale ?? 1.0;
    const revealDepth = Math.max(1, edgeRevealDepth ?? 1);
    const hideEdges = !!edgesHidden;

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

    const positioned: GraphPosition[] = positions ?? computeGalaxyLayout3D(nodes, links, {
      clusterStrength: layout?.clusterStrength,
      chargeStrength: layout?.chargeStrength,
      linkDistance: layout?.linkDistance,
    });
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
    for (const p of positioned) {
      if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
      if (p.z < zMin) zMin = p.z; if (p.z > zMax) zMax = p.z;
    }
    const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2, cz = (zMin + zMax) / 2;
    const extent = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) || 1;
    const norm = ((2 * L.fit) / extent) * spreadScale;
    const worldById = new Map<string, THREE.Vector3>();
    for (const p of positioned) {
      worldById.set(p.id, new THREE.Vector3((p.x - cx) * norm, (p.y - cy) * norm, (p.z - cz) * norm));
    }

    const neighbors = new Map<string, Set<string>>();
    for (const l of links) {
      (neighbors.get(l.source) ?? neighbors.set(l.source, new Set()).get(l.source)!).add(l.target);
      (neighbors.get(l.target) ?? neighbors.set(l.target, new Set()).get(l.target)!).add(l.source);
    }

    // ── nodes: ONE InstancedMesh ──────────────────────────────────────────
    const geo = new THREE.SphereGeometry(1, 16, 12);
    const mat = new THREE.MeshLambertMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, nodes.length);
    const dummy = new THREE.Object3D();
    const baseColors: THREE.Color[] = [];
    nodes.forEach((n, i) => {
      const w = worldById.get(n.id);
      const style = nodeStyle(n);
      dummy.position.copy(w ?? new THREE.Vector3());
      dummy.scale.setScalar(Math.max(0.001, style.radius * L.radiusScale * sizeScale));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const c = new THREE.Color(style.color);
      baseColors.push(c);
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);

    // ── edges: fat LineSegments2 (real px width), per kind ────────────────
    function buildFatLines(subset: GraphLink[], kind: 'relation' | 'mention'): LineSegments2 | null {
      const style = edgeStyle({ source: '', target: '', kind });
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
      const m = new LineMaterial({
        color: style.color,
        linewidth: Math.max(0.1, style.width * L.edgeWidthScale),
        transparent: true,
        opacity: Math.min(1, style.alpha * L.edgeOpacityScale),
      });
      m.resolution.set(width, height);
      return new LineSegments2(g, m);
    }
    const relFull = buildFatLines(links, 'relation');
    const menFull = buildFatLines(links, 'mention');
    if (relFull) { relFull.visible = !hideEdges; scene.add(relFull); }
    if (menFull) { menFull.visible = !hideEdges; scene.add(menFull); }

    // reveal group (n-hop neighborhood when edges hidden)
    const revealGroup = new THREE.Group();
    scene.add(revealGroup);
    let revealKids: LineSegments2[] = [];
    function clearReveal() {
      for (const s of revealKids) {
        revealGroup.remove(s);
        s.geometry.dispose();
        (s.material as THREE.Material).dispose();
      }
      revealKids = [];
    }
    function nodesWithin(focus: string, depth: number): Set<string> {
      const seen = new Set<string>([focus]);
      let frontier = [focus];
      for (let d = 0; d < depth; d++) {
        const next: string[] = [];
        for (const f of frontier) {
          for (const nb of neighbors.get(f) ?? []) {
            if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
          }
        }
        frontier = next;
      }
      return seen;
    }
    function rebuildReveal(focusId: string | null) {
      clearReveal();
      if (!hideEdges || !focusId) return;
      const set = nodesWithin(focusId, revealDepth);
      const subset = links.filter((l) => set.has(l.source) && set.has(l.target));
      for (const kind of ['relation', 'mention'] as const) {
        const seg = buildFatLines(subset, kind);
        if (seg) { revealGroup.add(seg); revealKids.push(seg); }
      }
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // ── SELECTIVE bloom: nodes only, never edges (two composers) ──────────
    let bloomComposer: EffectComposer | null = null;
    let finalComposer: EffectComposer | null = null;
    let mixPass: ShaderPass | null = null;
    if (glowEnabled) {
      bloomComposer = new EffectComposer(renderer);
      bloomComposer.renderToScreen = false;
      bloomComposer.addPass(new RenderPass(scene, camera));
      bloomComposer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), L.bloomStrength, L.bloomRadius, L.bloomThreshold));

      finalComposer = new EffectComposer(renderer);
      finalComposer.addPass(new RenderPass(scene, camera));
      mixPass = new ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: bloomComposer.renderTarget2.texture },
          },
          vertexShader: MIX_SHADER.vertexShader,
          fragmentShader: MIX_SHADER.fragmentShader,
        }),
        'baseTexture',
      );
      mixPass.needsSwap = true;
      finalComposer.addPass(mixPass);
      finalComposer.addPass(new OutputPass());
    }

    // ── hover dim + click via Raycaster ───────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoveredId: string | null = null;
    let pinnedId: string | null = null;

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
      const keep = id ? (neighbors.get(id) ?? new Set<string>()) : null;
      nodes.forEach((n, i) => {
        const full = !keep || n.id === id || keep.has(n.id);
        const base = baseColors[i];
        mesh.setColorAt(i, full ? base : new THREE.Color(base.r * L.dimFactor, base.g * L.dimFactor, base.b * L.dimFactor));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    function onMove(ev: PointerEvent) {
      const id = pickId(ev);
      if (id === hoveredId) return;
      hoveredId = id;
      applyHoverDim(id ?? pinnedId);
      rebuildReveal(id ?? pinnedId);
      onHoverNode?.(id);
    }
    let downX = 0, downY = 0;
    function onDown(ev: PointerEvent) { downX = ev.clientX; downY = ev.clientY; }
    function onUp(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) return; // drag, not click
      const id = pickId(ev);
      pinnedId = id;            // click a node pins it; click background clears
      applyHoverDim(id);
      rebuildReveal(id);
      if (id) onNavigate(id);
    }
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    let raf = 0;
    let disposed = false;
    function frame() {
      if (disposed) return;
      controls.update();
      if (bloomComposer && finalComposer) {
        // bloom pass sees ONLY nodes -> hide every edge object first
        const rv = relFull?.visible, mv = menFull?.visible, gv = revealGroup.visible;
        if (relFull) relFull.visible = false;
        if (menFull) menFull.visible = false;
        revealGroup.visible = false;
        bloomComposer.render();
        if (relFull) relFull.visible = rv ?? false;
        if (menFull) menFull.visible = mv ?? false;
        revealGroup.visible = gv;
        finalComposer.render();
      } else {
        renderer.render(scene, camera);
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      controls.dispose();
      bloomComposer?.dispose();
      finalComposer?.dispose();
      clearReveal();
      geo.dispose();
      mat.dispose();
      for (const seg of [relFull, menFull]) {
        if (!seg) continue;
        seg.geometry.dispose();
        (seg.material as THREE.Material).dispose();
      }
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    nodes, links, nodeStyle, edgeStyle, posKey, positions, lookKey,
    layout?.mode, layout?.clusterStrength, layout?.chargeStrength, layout?.linkDistance, layout?.spreadScale,
    glowEnabled, nodeSizeScale, edgesHidden, edgeRevealDepth, onNavigate, onHoverNode,
  ]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default GraphCanvas;
