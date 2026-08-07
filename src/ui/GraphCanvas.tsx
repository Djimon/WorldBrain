// M16-S03 (#324) — the ONE renderer core for every graph view (D12): global
// (this story), Galaxy (S04), Ring (S05), Ego (S07) are all THIS component
// with a different {nodes, links} slice + layout config. No graph "kind"
// branches here; the caller decides what to render.
//
// Renderer = three.js (raw), decided in the open bench #326 (real GPU-3D beat
// Pixi/Sigma on look). NOT react-force-graph-3d (Kapsule deferred-digest
// workarounds, see #320). Recipe ported from src/spikes/graph-bench/adapters/
// threeAdapter.ts:
//   - nodes: ONE InstancedMesh (per-instance color+scale) -> few draw calls
//   - edges: TWO LineSegments (relation/mention)
//   - camera headlight, OrbitControls (rotate/pan/zoom)
//   - Bloom (UnrealBloomPass + sRGB-decode) ONLY when glowEnabled (D2, default off)
//   - click/hover via Raycaster on the InstancedMesh
// Layout is 3D (computeGalaxyLayout3D); a caller may pass precomputed
// `positions` to skip the force sim (look-tuning harness, later S10 #327).
// All look knobs live in `look` (GraphLookConfig) with DEFAULT_LOOK = the
// tuned production values; omit it and production behaviour is unchanged.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { GraphLink, GraphNode } from '../services/graph-model';
import type { EdgeVisualStyle, NodeVisualStyle } from '../services/graph-style';
import { computeGalaxyLayout3D } from '../services/galaxy-layout';

export interface GraphLayoutConfig {
  mode: 'force' | 'galaxy' | 'ring';
  clusterStrength?: number;
  chargeStrength?: number;
  linkDistance?: number;
  // Visual spread multiplier applied after position normalization (>1 spreads out).
  spreadScale?: number;
}

// Every hardcoded look value, tunable. Defaults ARE the production look.
export interface GraphLookConfig {
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  radiusScale: number;        // style.radius [6..22] -> world units
  lightAzimuth: number;       // radians (horizontal)
  lightElevation: number;     // radians (vertical)
  lightIntensity: number;
  ambientIntensity: number;
  dimFactor: number;          // non-neighbor darkening on hover
  fit: number;                // half-extent in world units
  camDistanceFactor: number;  // camera z = fit * this
}

export const DEFAULT_LOOK: GraphLookConfig = {
  bloomStrength: 0.7,
  bloomRadius: 0.85,
  bloomThreshold: 0,
  radiusScale: 0.6,
  // reproduces the original (-0.4, 0.4, 1) headlight direction
  lightAzimuth: Math.atan2(-0.4, 1),
  lightElevation: Math.atan2(0.4, Math.hypot(-0.4, 1)),
  lightIntensity: 1.4,
  ambientIntensity: 0.55,
  dimFactor: 0.22,
  fit: 600,
  camDistanceFactor: 2.4,
};

export interface GraphPosition { id: string; x: number; y: number; z: number; }

export interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeStyle: (node: GraphNode) => NodeVisualStyle;
  edgeStyle: (link: GraphLink) => EdgeVisualStyle;
  layout?: GraphLayoutConfig;
  // Precomputed 3D positions — if given, the force sim is skipped (lets a
  // tuner re-render on look changes without recomputing the layout).
  positions?: GraphPosition[];
  look?: Partial<GraphLookConfig>;
  // D2: per-node bloom glow — OFF by default; on/off via S06.
  glowEnabled?: boolean;
  // Uniform multiplier on node radius. Default 1.
  nodeSizeScale?: number;
  onNavigate: (id: string) => void;
  onHoverNode?: (id: string | null) => void;
}

const FALLBACK_W = 800;
const FALLBACK_H = 600;

// sRGB->linear decode so Bloom runs in linear light and OutputPass's re-encode
// is not a double-encode (the grey-haze bug — see spike memory).
const SRGB_DECODE = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse;
    vec3 s2l(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055,vec3(2.4)), step(0.04045,c)); }
    void main(){ vec4 t=texture2D(tDiffuse,vUv); gl_FragColor=vec4(s2l(t.rgb),t.a); }
  `,
};

export function GraphCanvas({
  nodes, links, nodeStyle, edgeStyle, layout, positions, look, glowEnabled, nodeSizeScale, onNavigate, onHoverNode,
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

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 1, 20000);
    camera.position.set(0, 0, L.fit * L.camDistanceFactor);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mountEl.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, L.ambientIntensity));
    const headlight = new THREE.DirectionalLight(0xffffff, L.lightIntensity);
    const dx = Math.sin(L.lightAzimuth) * Math.cos(L.lightElevation);
    const dy = Math.sin(L.lightElevation);
    const dz = Math.cos(L.lightAzimuth) * Math.cos(L.lightElevation);
    headlight.position.set(dx, dy, dz);
    camera.add(headlight);
    camera.add(headlight.target);
    scene.add(camera);

    // 3D positions: precomputed (skip sim) or force layout, then normalize into
    // a centered cube of half-extent L.fit*spread.
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

    // adjacency (for hover dim)
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

    // ── edges: TWO LineSegments (relation / mention) ──────────────────────
    function buildLines(kind: 'relation' | 'mention'): THREE.LineSegments {
      const style = edgeStyle({ source: '', target: '', kind });
      const pts: number[] = [];
      for (const l of links) {
        if (l.kind !== kind) continue;
        const a = worldById.get(l.source), b = worldById.get(l.target);
        if (!a || !b) continue;
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const m = new THREE.LineBasicMaterial({ color: style.color, transparent: true, opacity: style.alpha });
      return new THREE.LineSegments(g, m);
    }
    const relLines = buildLines('relation');
    const menLines = buildLines('mention');
    scene.add(relLines, menLines);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    // ── bloom composer (only when glow on) ────────────────────────────────
    let composer: EffectComposer | null = null;
    if (glowEnabled) {
      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(new ShaderPass(SRGB_DECODE));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), L.bloomStrength, L.bloomRadius, L.bloomThreshold));
      composer.addPass(new OutputPass());
    }

    // ── hover dim + click via Raycaster on the InstancedMesh ──────────────
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let hoveredId: string | null = null;

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
      applyHoverDim(id);
      onHoverNode?.(id);
    }
    let downX = 0, downY = 0;
    function onDown(ev: PointerEvent) { downX = ev.clientX; downY = ev.clientY; }
    function onUp(ev: PointerEvent) {
      if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) return; // was a drag
      const id = pickId(ev);
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
      if (composer) composer.render();
      else renderer.render(scene, camera);
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
      composer?.dispose();
      geo.dispose();
      mat.dispose();
      relLines.geometry.dispose();
      (relLines.material as THREE.Material).dispose();
      menLines.geometry.dispose();
      (menLines.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
    // Full remount on any input change — rebuilt from scratch (intentional).
    // Passing `positions` avoids the expensive relayout on look-only changes.
  }, [
    nodes, links, nodeStyle, edgeStyle, posKey, positions, lookKey,
    layout?.mode, layout?.clusterStrength, layout?.chargeStrength, layout?.linkDistance, layout?.spreadScale,
    glowEnabled, nodeSizeScale, onNavigate, onHoverNode,
  ]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default GraphCanvas;
