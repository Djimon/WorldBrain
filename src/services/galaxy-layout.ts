// M16-S04 (#318): Galaxy-Modus — Cluster-nach-Typ-Kraft in der d3-force-Sim.
// Reine Layout-Logik (Positionen), kein Pixi/GPU, kein eigener Renderer
// (D12: derselbe GraphCanvas wie S03, nur eine andere Layout-Config-Prop).
// Bestehende Kräfte (forceManyBody/charge, forceLink, forceCenter) bleiben;
// die Cluster-Kraft kommt additiv dazu.
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

// A d3-force-compatible custom force — register via
// `simulation.force('cluster', forceCluster(nodes, strength))`. On each
// simulation tick, pulls every node toward the centroid of all nodes
// sharing its `type`, scaled by `alpha` (per d3-force's own force-function
// contract) and `strength`. Mutates node.vx/vy in place, like d3-force's
// built-in forces (forceManyBody, forceX, ...).
export function forceCluster(_nodes: GraphNode[], _strength?: number): (alpha: number) => void {
  throw new Error('not implemented');
}

// Pre-computes and stops (D10) a d3-force simulation — forceManyBody +
// forceLink + forceCenter (existing/unchanged) + forceCluster (additive,
// this story) — for a fixed tick count with a fixed seed, so the same input
// always yields the same output positions (deterministic, testable without
// asserting on a live/ticking simulation).
export function computeGalaxyLayout(
  _nodes: GraphNode[],
  _links: GraphLink[],
  _options?: GalaxyLayoutOptions,
): PositionedNode[] {
  throw new Error('not implemented');
}
