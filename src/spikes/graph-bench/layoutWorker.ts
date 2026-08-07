// d3-force-3d layout in a Web Worker (the belegte Obsidian/graphier pattern:
// physics off the UI thread). Runs a fixed number of ticks then posts final
// positions + elapsed ms. 3D positions (x,y,z); 2D adapters ignore z.
import {
  forceSimulation, forceManyBody, forceLink, forceCenter,
} from 'd3-force-3d';
import type { BenchModel } from './model';

export interface LayoutRequest {
  model: BenchModel;
  ticks: number;
  dims: 2 | 3;
}

export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface LayoutResult {
  positions: LayoutPosition[];
  ms: number;
}

self.onmessage = (ev: MessageEvent<LayoutRequest>) => {
  const { model, ticks, dims } = ev.data;
  const t0 = performance.now();

  // d3-force mutates node objects in place with x/y/z — clone so we don't
  // touch the transferred model.
  const simNodes: { id: string; x?: number; y?: number; z?: number }[] =
    model.nodes.map((n) => ({ id: n.id }));
  const simLinks = model.links.map((l) => ({ source: l.source, target: l.target }));

  const sim = forceSimulation(simNodes, dims)
    .numDimensions(dims)
    .force('charge', forceManyBody().strength(-30))
    .force('link', forceLink(simLinks).id((d) => d.id as string).distance(30))
    .force('center', forceCenter())
    .stop();

  sim.tick(ticks);

  const positions: LayoutPosition[] = simNodes.map((n) => ({
    id: n.id,
    x: n.x ?? 0,
    y: n.y ?? 0,
    z: n.z ?? 0,
  }));

  const result: LayoutResult = { positions, ms: performance.now() - t0 };
  (self as unknown as Worker).postMessage(result);
};
