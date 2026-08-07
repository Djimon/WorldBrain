// Sigma v3 + graphology — WebGL 2D, built-in camera (pan/zoom), built for
// large graphs with offline layout. Positions come precomputed (x,y). Node
// size = degree, color = type; edge size/color = relation vs mention (D5).
// Glow is NOT built in — it needs a custom node WebGL program; honestly noted.
// Sigma is event-driven (renders only on change) which is a real perf edge;
// for a comparable fps number the bench forces a refresh each frame.
import Graph from 'graphology';
import Sigma from 'sigma';
import type { BenchModel } from '../model';
import { BENCH_TYPE_COLORS } from '../model';
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
  const graph = new Graph({ multi: true, type: 'undirected' });

  let maxDeg = 1;
  for (const n of model.nodes) if (n.degree > maxDeg) maxDeg = n.degree;

  for (const n of model.nodes) {
    const p = positions.get(n.id);
    if (!p) continue;
    const t = Math.sqrt(n.degree / maxDeg);
    graph.addNode(n.id, {
      x: p.x,
      y: p.y,
      size: NODE_MIN + t * (NODE_MAX - NODE_MIN),
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
    renderLabels: false, // labels are LOD; off for a raw render bench
    defaultEdgeColor: '#888',
  });

  let raf = 0;
  let disposed = false;
  function frame() {
    if (disposed) return;
    renderer.refresh({ skipIndexation: true });
    opts.onFrame(performance.now());
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    glowNote: 'NOT built-in — needs a custom node WebGL program (most work of the three)',
    setGlow() { /* unsupported without a custom node program */ },
    resize() { renderer.refresh(); },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      renderer.kill();
    },
  };
}
