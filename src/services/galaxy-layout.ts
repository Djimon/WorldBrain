// M16-S04 (#318): Galaxy-Modus — Cluster-nach-Typ-Kraft in der d3-force-Sim.
// Reine Layout-Logik (Positionen), kein Pixi/GPU, kein eigener Renderer
// (D12: derselbe GraphCanvas wie S03, nur eine andere Layout-Config-Prop).
// Bestehende Kräfte (forceManyBody/charge, forceLink, forceCenter) bleiben;
// die Cluster-Kraft kommt additiv dazu.
import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import {
  forceCenter as forceCenter3d,
  forceLink as forceLink3d,
  forceManyBody as forceManyBody3d,
  forceSimulation as forceSimulation3d,
} from 'd3-force-3d';
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
  // d3-force charge (repulsion). Kept at -60 as default for test stability
  // (S04 tests pin relative distances); callers that want visual spread pass
  // a stronger value (e.g. GraphCanvas uses -200 by default).
  chargeStrength?: number;
  // d3-force link spring rest length. Default 20 (test-stable); visual
  // callers use 80.
  linkDistance?: number;
}

const DEFAULT_CLUSTER_STRENGTH = 0.3;
const DEFAULT_TICKS = 300;
const DEFAULT_SEED = 1;
const DEFAULT_CHARGE_STRENGTH = -60;
const DEFAULT_LINK_DISTANCE = 20;

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
  const {
    clusterStrength = DEFAULT_CLUSTER_STRENGTH,
    ticks = DEFAULT_TICKS,
    seed = DEFAULT_SEED,
    chargeStrength = DEFAULT_CHARGE_STRENGTH,
    linkDistance = DEFAULT_LINK_DISTANCE,
  } = options;
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
    .force('charge', forceManyBody().strength(chargeStrength))
    .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(simLinks).id((d) => d.id).distance(linkDistance))
    .force('center', forceCenter(0, 0))
    .force('cluster', forceCluster(simNodes, clusterStrength))
    .stop();

  for (let i = 0; i < ticks; i++) simulation.tick();

  return simNodes.map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0 }));
}

// ── 3D variant (M16-S03, Renderer = three.js, Spike #326) ────────────────────
// Same idea in 3D via d3-force-3d: real volumetric galaxy (x/y/z), consumed by
// the three.js GraphCanvas. The 2D fns above stay for the S04 tests + any 2D
// use. Worker offloading of this is a later story (S10 #327).

export interface PositionedNode3D extends GraphNode {
  x: number;
  y: number;
  z: number;
}

interface Sim3DNode extends GraphNode {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

// 3D analogue of forceCluster: pulls each node toward its type-centroid in x/y/z.
export function forceCluster3D(nodes: GraphNode[], strength = DEFAULT_CLUSTER_STRENGTH): (alpha: number) => void {
  const simNodes = nodes as Sim3DNode[];
  return (alpha: number) => {
    const centroids = new Map<string, { x: number; y: number; z: number; count: number }>();
    for (const n of simNodes) {
      const c = centroids.get(n.type) ?? { x: 0, y: 0, z: 0, count: 0 };
      c.x += n.x ?? 0; c.y += n.y ?? 0; c.z += n.z ?? 0; c.count += 1;
      centroids.set(n.type, c);
    }
    for (const c of centroids.values()) { c.x /= c.count; c.y /= c.count; c.z /= c.count; }
    for (const n of simNodes) {
      const c = centroids.get(n.type)!;
      n.vx += (c.x - n.x) * strength * alpha;
      n.vy += (c.y - n.y) * strength * alpha;
      n.vz += (c.z - n.z) * strength * alpha;
    }
  };
}

export function computeGalaxyLayout3D(
  nodes: GraphNode[],
  links: GraphLink[],
  options: GalaxyLayoutOptions = {},
): PositionedNode3D[] {
  const {
    clusterStrength = DEFAULT_CLUSTER_STRENGTH,
    ticks = DEFAULT_TICKS,
    seed = DEFAULT_SEED,
    chargeStrength = DEFAULT_CHARGE_STRENGTH,
    linkDistance = DEFAULT_LINK_DISTANCE,
  } = options;
  const rng = mulberry32(seed);
  const simNodes: Sim3DNode[] = nodes.map((n) => ({
    ...n,
    x: (rng() - 0.5) * 400,
    y: (rng() - 0.5) * 400,
    z: (rng() - 0.5) * 400,
    vx: 0, vy: 0, vz: 0,
  }));
  const simLinks = links.map((l) => ({ source: l.source, target: l.target }));

  const simulation = forceSimulation3d(simNodes, 3)
    .force('charge', forceManyBody3d().strength(chargeStrength))
    .force('link', forceLink3d(simLinks).id((d) => d.id as string).distance(linkDistance))
    .force('center', forceCenter3d())
    .force('cluster', forceCluster3D(simNodes, clusterStrength))
    .stop();

  simulation.tick(ticks);

  return simNodes.map((n) => ({ ...n, x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 }));
}
