// d3-force-3d ships no types. Minimal ambient decl for the pieces we call
// (3D force simulation) — used by the graph 3D layout (galaxy-layout.ts) and
// the renderer bench. Extend as needed.
declare module 'd3-force-3d' {
  interface SimNode {
    id?: string;
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    [k: string]: unknown;
  }
  interface Simulation {
    nodes(nodes: unknown[]): Simulation;
    force(name: string, force: unknown): Simulation;
    numDimensions(n: number): Simulation;
    stop(): Simulation;
    tick(n?: number): Simulation;
    alpha(a: number): Simulation;
    alphaDecay(a: number): Simulation;
  }
  interface ForceLink {
    id(fn: (n: SimNode) => string): ForceLink;
    distance(d: number): ForceLink;
  }
  interface ForceManyBody {
    strength(s: number): ForceManyBody;
  }
  export function forceSimulation(nodes?: unknown[], numDimensions?: number): Simulation;
  export function forceManyBody(): ForceManyBody;
  export function forceLink(links: unknown[]): ForceLink;
  export function forceCenter(x?: number, y?: number, z?: number): unknown;
}
