// @vitest-environment node
// M16-S04: Galaxy-Modus — Cluster-nach-Typ-Kraft in der Force-Sim (#318)
// See: https://github.com/Djimon/WorldBrain/issues/318
//
// Reine Force-/Positions-Logik, kein Pixi/GPU. D12: dasselbe GraphCanvas,
// nur andere Layout-Config — hier wird ausschließlich die Positions-
// Berechnung getestet, kein Rendering.
// AP-005: ESM import only, no require().

import { describe, expect, it } from 'vitest';
import { computeGalaxyLayout, forceCluster } from '../src/services/galaxy-layout';
import type { GraphLink, GraphNode } from '../src/services/graph-model';

function makeNodes(): GraphNode[] {
  return [
    { id: 'a1', type: 'Character', label: 'Ada', degree: 1 },
    { id: 'a2', type: 'Character', label: 'Bob', degree: 1 },
    { id: 'a3', type: 'Character', label: 'Cara', degree: 1 },
    { id: 'b1', type: 'Location', label: 'Tavern', degree: 1 },
    { id: 'b2', type: 'Location', label: 'Castle', degree: 1 },
    { id: 'b3', type: 'Location', label: 'Docks', degree: 1 },
  ];
}
const LINKS: GraphLink[] = [];

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function avgPairwiseDistance(nodes: { x: number; y: number }[]): number {
  let sum = 0, count = 0;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      sum += dist(nodes[i], nodes[j]);
      count++;
    }
  }
  return count === 0 ? 0 : sum / count;
}

describe('M16-S04 forceCluster: registered as a d3-force-compatible custom force', () => {
  it('forceCluster(nodes, strength) returns a force function (alpha) => void', () => {
    const force = forceCluster(makeNodes(), 0.5);
    expect(typeof force).toBe('function');
  });

  it('applying the force pulls a node toward its type-centroid (velocity moves it closer)', () => {
    const nodes = makeNodes().map((n, i) => ({ ...n, x: i * 100, y: 0, vx: 0, vy: 0 })) as unknown as GraphNode[];
    const force = forceCluster(nodes, 1);
    force(1); // alpha = 1, full strength
    const a1 = nodes[0] as unknown as { vx: number };
    // a1 (Character, x=0) should have gained a positive vx pulling it toward
    // the other Character nodes (x=100, x=200) — i.e. toward the centroid.
    expect(a1.vx).toBeGreaterThan(0);
  });
});

describe('M16-S04 computeGalaxyLayout: cluster property after convergence', () => {
  it('same-type nodes end up closer together on average than different-type nodes', () => {
    const nodes = makeNodes();
    const positioned = computeGalaxyLayout(nodes, LINKS, { ticks: 300, seed: 1 });

    const characters = positioned.filter((n) => n.type === 'Character');
    const locations = positioned.filter((n) => n.type === 'Location');

    const avgWithinCharacters = avgPairwiseDistance(characters);
    const avgWithinLocations = avgPairwiseDistance(locations);
    const avgAcrossTypes = (() => {
      let sum = 0, count = 0;
      for (const c of characters) {
        for (const l of locations) { sum += dist(c, l); count++; }
      }
      return sum / count;
    })();

    expect(avgWithinCharacters).toBeLessThan(avgAcrossTypes);
    expect(avgWithinLocations).toBeLessThan(avgAcrossTypes);
  });

  it('every node gets a finite (x, y) position', () => {
    const positioned = computeGalaxyLayout(makeNodes(), LINKS, { ticks: 300, seed: 1 });
    expect(positioned).toHaveLength(6);
    for (const n of positioned) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });
});

describe('M16-S04 determinism: fixed seed/tick count -> reproducible positions', () => {
  it('the same input (nodes, links, seed, ticks) yields identical positions on repeated runs', () => {
    const first = computeGalaxyLayout(makeNodes(), LINKS, { ticks: 300, seed: 42 });
    const second = computeGalaxyLayout(makeNodes(), LINKS, { ticks: 300, seed: 42 });
    expect(second).toEqual(first);
  });

  it('a different seed may yield different positions (sanity: seed actually affects the run)', () => {
    const withSeed1 = computeGalaxyLayout(makeNodes(), LINKS, { ticks: 300, seed: 1 });
    const withSeed2 = computeGalaxyLayout(makeNodes(), LINKS, { ticks: 300, seed: 2 });
    expect(withSeed1).not.toEqual(withSeed2);
  });
});

describe('M16-S04: existing forces stay in effect (additive, not a replacement)', () => {
  it('linked nodes end up closer than an unrelated pair of the same type (forceLink still applies)', () => {
    const nodes = makeNodes();
    const links: GraphLink[] = [{ source: 'a1', target: 'a2', kind: 'relation' }];
    const positioned = computeGalaxyLayout(nodes, links, { ticks: 300, seed: 1 });
    const byId = Object.fromEntries(positioned.map((n) => [n.id, n]));
    const linkedDist = dist(byId.a1, byId.a2);
    const unlinkedDist = dist(byId.a1, byId.a3);
    expect(linkedDist).toBeLessThan(unlinkedDist);
  });
});
