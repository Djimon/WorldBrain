// M16-S04 (#318): Galaxy-Modus — Cluster-nach-Typ-Kraft in der d3-force-Sim.
// Reine Layout-Logik (Positionen), kein Pixi/GPU, kein eigener Renderer
// (D12: derselbe GraphCanvas wie S03, nur eine andere Layout-Config-Prop).
// Bestehende Kräfte (forceManyBody/charge, forceLink, forceCenter) bleiben;
// die Cluster-Kraft kommt additiv dazu.
import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { GraphLink, GraphNode } from './graph-model';

export interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

export interface GalaxyLayoutOptions {
  // Additive pull strength toward each type's centroid (tunable per AC).
  clusterStrength?: number;
  // D10: fixed tick count instead of live simulation — pre-compute and stop.
  ticks?: number;
  // Determinism for testing: fixed seed for d3-force's initial jitter.
  seed?: number;
}

const DEFAULT_CLUSTER_STRENGTH = 0.3;
const DEFAULT_TICKS = 300;
const DEFAULT_SEED = 1;

type SimNode = GraphNode & SimulationNodeDatum;

// A d3-force-compatible custom force — register via
// `simulation.force('cluster', forceCluster(nodes, strength))`. On each
// simulation tick, pulls every node toward the centroid of all nodes
// sharing its `type`, scaled by `alpha` (per d3-force's own force-function
// contract) and `strength`. Mutates node.vx/vy in place, like d3-force's
// built-in forces (forceManyBody, forceX, ...).
export function forceCluster(nodes: GraphNode[], strength = DEFAULT_CLUSTER_STRENGTH): (alpha: number) => void {
  const simNodes = nodes as SimNode[];
  return (alpha: number) => {
    const centroids = new Map<string, { x: number; y: number; count: number }>();
    for (const n of simNodes) {
      const c = centroids.get(n.type) ?? { x: 0, y: 0, count: 0 };
      c.x += n.x ?? 0;
      c.y += n.y ?? 0;
      c.count += 1;
      centroids.set(n.type, c);
    }
    for (const c of centroids.values()) { c.x /= c.count; c.y /= c.count; }
    for (const n of simNodes) {
      const c = centroids.get(n.type)!;
      n.vx = (n.vx ?? 0) + ((c.x - (n.x ?? 0)) * strength * alpha);
      n.vy = (n.vy ?? 0) + ((c.y - (n.y ?? 0)) * strength * alpha);
    }
  };
}

// Small seedable PRNG (mulberry32) for deterministic initial positions —
// d3-force's own jiggle (Math.random) only fires for exactly-coincident
// nodes, which distinct seeded initial positions never produce, so the rest
// of the tick sequence stays fully deterministic given a fixed seed.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Pre-computes and stops (D10) a d3-force simulation — forceManyBody +
// forceLink + forceCenter (existing/unchanged) + forceCluster (additive,
// this story) — for a fixed tick count with a fixed seed, so the same input
// always yields the same output positions (deterministic, testable without
// asserting on a live/ticking simulation).
export function computeGalaxyLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  options: GalaxyLayoutOptions = {},
): PositionedNode[] {
  const { clusterStrength = DEFAULT_CLUSTER_STRENGTH, ticks = DEFAULT_TICKS, seed = DEFAULT_SEED } = options;
  const rng = mulberry32(seed);
  const simNodes: SimNode[] = nodes.map((n) => ({
    ...n,
    x: (rng() - 0.5) * 400,
    y: (rng() - 0.5) * 400,
    vx: 0,
    vy: 0,
  }));
  const simLinks = links.map((l) => ({ ...l })) as unknown as SimulationLinkDatum<SimNode>[];

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-60))
    .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).id((d) => d.id).distance(20))
    .force('center', forceCenter(0, 0))
    .force('cluster', forceCluster(simNodes, clusterStrength))
    .stop();

  for (let i = 0; i < ticks; i++) simulation.tick();

  return simNodes.map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0 }));
}
