// Sigma v3 + graphology rendering the SAME rotatable 3D galaxy. Sigma owns the
// node coordinate/camera pipeline, so 3D is done by rewriting every node's x/y
// from a manual projection each frame, then refreshing. This directly measures
// whether Sigma can absorb 10k attribute updates + a rerender per frame.
// Rotate = custom drag (Sigma's own pan is suppressed); zoom = Sigma's camera.
import Graph from 'graphology';
import Sigma from 'sigma';
import type { BenchModel } from '../model';
import { BENCH_TYPE_COLORS } from '../model';
import { normalize3D, rotate, persp } from '../project';
import type { P3, Orbit } from '../project';
import type { AdapterOptions, PositionMap, RendererHandle } from './types';

const NODE_MIN = 2;
const NODE_MAX = 14;

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export function sigmaAdapter(
  container: HTMLElement,
  model: BenchModel,
  positions: PositionMap,
  opts: AdapterOptions,
): RendererHandle {
  const norm = normalize3D(positions);
  const orbit: Orbit = { yaw: 0.6, pitch: 0.3, zoom: 1 };

  let maxDeg = 1;
  for (const n of model.nodes) if (n.degree > maxDeg) maxDeg = n.degree;

  const graph = new Graph({ multi: true, type: 'undirected' });
  const baseSize = new Map<string, number>();
  const np3 = new Map<string, P3>();

  for (const n of model.nodes) {
    const p = norm.get(n.id);
    if (!p) continue;
    const t = Math.sqrt(n.degree / maxDeg);
    const size = NODE_MIN + t * (NODE_MAX - NODE_MIN);
    baseSize.set(n.id, size);
    np3.set(n.id, p);
    const r = rotate(p, orbit.yaw, orbit.pitch);
    const f = persp(r.z);
    graph.addNode(n.id, {
      x: r.x * f, y: r.y * f, size: size * f,
      color: hex(BENCH_TYPE_COLORS[n.type] ?? 0xcccccc),
    });
  }
  for (const l of model.links) {
    if (!graph.hasNode(l.source) || !graph.hasNode(l.target)) continue;
    graph.addEdge(l.source, l.target, {
      size: l.kind === 'relation' ? 1.6 : 0.8,
      color: l.kind === 'relation' ? 'rgba(174,182,194,0.55)' : 'rgba(255,53,38,0.3)',
    });
  }

  const renderer = new Sigma(graph, container as HTMLDivElement, {
    renderEdgeLabels: false,
    renderLabels: false,
    defaultEdgeColor: '#888',
  });

  // rotate via custom drag; suppress Sigma's own pan by eating pointerdown.
  let dragging = false, lx = 0, ly = 0;
  const HALF_PI = Math.PI / 2 - 0.01;
  const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; e.stopPropagation(); };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    orbit.yaw += (e.clientX - lx) * 0.008;
    orbit.pitch += (e.clientY - ly) * 0.008;
    orbit.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, orbit.pitch));
    lx = e.clientX; ly = e.clientY;
  };
  const up = () => { dragging = false; };
  container.addEventListener('pointerdown', down, true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);

  let raf = 0;
  let disposed = false;
  function frame() {
    if (disposed) return;
    graph.updateEachNodeAttributes((id, attr) => {
      const p = np3.get(id)!;
      const r = rotate(p, orbit.yaw, orbit.pitch);
      const f = persp(r.z);
      attr.x = r.x * f;
      attr.y = r.y * f;
      attr.size = (baseSize.get(id) ?? NODE_MIN) * f;
      return attr;
    }, { attributes: ['x', 'y', 'size'] });
    renderer.refresh({ skipIndexation: true });
    opts.onFrame(performance.now());
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    glowNote: 'NOT built-in (needs custom node program); 3D = 10k attr-rewrites/frame',
    setGlow() { /* unsupported without a custom node program */ },
    resize() { renderer.refresh(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      container.removeEventListener('pointerdown', down, true);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      renderer.kill();
    },
  };
}
