// three.js (r185) raw — the graphier scale pattern: ALL nodes in ONE
// InstancedMesh (per-instance color + scale), edges in TWO LineSegments
// (relation/mention) = a handful of draw calls regardless of node count.
// Real 3D: OrbitControls rotate/pan/zoom. Glow = UnrealBloomPass with the
// sRGB-decode fix (see memory reference-three-bloom-double-srgb).
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import type { BenchModel } from '../model';
import { BENCH_TYPE_COLORS } from '../model';
import type { AdapterOptions, PositionMap, RendererHandle } from './types';

const NODE_MIN = 3;
const NODE_MAX = 16;
const FIT = 600; // target half-extent in world units

// sRGB->linear decode so Bloom works in linear light and the final OutputPass
// re-encode is not a double encode (the grey-haze bug).
const SRGB_DECODE = {
  uniforms: { tDiffuse: { value: null as THREE.Texture | null } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    varying vec2 vUv; uniform sampler2D tDiffuse;
    vec3 s2l(vec3 c){ return mix(c/12.92, pow((c+0.055)/1.055,vec3(2.4)), step(0.04045,c)); }
    void main(){ vec4 t=texture2D(tDiffuse,vUv); gl_FragColor=vec4(s2l(t.rgb),t.a); }
  `,
};

export function threeAdapter(
  container: HTMLElement,
  model: BenchModel,
  positions: PositionMap,
  opts: AdapterOptions,
): RendererHandle {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, opts.width / opts.height, 1, 20000);
  camera.position.set(0, 0, FIT * 2.4);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(opts.width, opts.height);
  container.appendChild(renderer.domElement);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const headlight = new THREE.DirectionalLight(0xffffff, 1.4);
  headlight.position.set(-0.4, 0.4, 1); // horizontal -10deg / vertical 10deg feel
  camera.add(headlight);
  camera.add(headlight.target);
  scene.add(camera);

  // normalize positions into a centered cube of half-extent FIT
  let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  for (const p of positions.values()) {
    if (p.x < xMin) xMin = p.x; if (p.x > xMax) xMax = p.x;
    if (p.y < yMin) yMin = p.y; if (p.y > yMax) yMax = p.y;
    if (p.z < zMin) zMin = p.z; if (p.z > zMax) zMax = p.z;
  }
  const cx = (xMin + xMax) / 2, cy = (yMin + yMax) / 2, cz = (zMin + zMax) / 2;
  const extent = Math.max(xMax - xMin, yMax - yMin, zMax - zMin) || 1;
  const norm = (2 * FIT) / extent;
  const world = new Map<string, THREE.Vector3>();
  for (const [id, p] of positions) {
    world.set(id, new THREE.Vector3((p.x - cx) * norm, (p.y - cy) * norm, (p.z - cz) * norm));
  }

  let maxDeg = 1;
  for (const n of model.nodes) if (n.degree > maxDeg) maxDeg = n.degree;

  // --- nodes: ONE InstancedMesh ---
  const geo = new THREE.SphereGeometry(1, 16, 12);
  const mat = new THREE.MeshLambertMaterial();
  const mesh = new THREE.InstancedMesh(geo, mat, model.nodes.length);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  model.nodes.forEach((n, i) => {
    const w = world.get(n.id);
    if (!w) return;
    const t = Math.sqrt(n.degree / maxDeg);
    const r = NODE_MIN + t * (NODE_MAX - NODE_MIN);
    dummy.position.copy(w);
    dummy.scale.setScalar(r);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, col.setHex(BENCH_TYPE_COLORS[n.type] ?? 0xcccccc));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);

  // --- edges: TWO LineSegments (relation / mention) ---
  function buildLines(kind: 'relation' | 'mention', color: number, opacity: number): THREE.LineSegments {
    const pts: number[] = [];
    for (const l of model.links) {
      if (l.kind !== kind) continue;
      const a = world.get(l.source), b = world.get(l.target);
      if (!a || !b) continue;
      pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.LineSegments(g, m);
  }
  const relLines = buildLines('relation', 0xaeb6c2, 0.5);
  const menLines = buildLines('mention', 0xff3526, 0.28);
  scene.add(relLines, menLines);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  // --- bloom composer (decode -> bloom -> output) ---
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const decode = new ShaderPass(SRGB_DECODE);
  composer.addPass(decode);
  const bloom = new UnrealBloomPass(new THREE.Vector2(opts.width, opts.height), 0.7, 0.85, 0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let glow = opts.glow;
  let raf = 0;
  let disposed = false;
  function frame() {
    if (disposed) return;
    controls.update();
    if (glow) composer.render();
    else renderer.render(scene, camera);
    opts.onFrame(performance.now());
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    glowNote: 'UnrealBloomPass native (post-processing, needs sRGB-decode fix)',
    setGlow(on: boolean) { glow = on; },
    resize(w: number, h: number) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      controls.dispose();
      composer.dispose();
      geo.dispose();
      mat.dispose();
      relLines.geometry.dispose();
      (relLines.material as THREE.Material).dispose();
      menLines.geometry.dispose();
      (menLines.material as THREE.Material).dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
