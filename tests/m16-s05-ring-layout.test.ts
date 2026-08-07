// M16-S05 (#290): Ring/Disc-Modus — reine Layout-Logik (kein three.js/GPU).
// Design: planning/research/graph-ring-disc-design.md. AP-005 ESM import only.
import { describe, expect, it } from 'vitest';
import { computeRingLayout, computeRingSectors } from '../src/services/ring-layout';
import type { GraphLink, GraphNode } from '../src/services/graph-model';

function node(id: string, type: string): GraphNode {
  return { id, type, label: id, degree: 0 };
}
function rel(source: string, target: string): GraphLink {
  return { source, target, kind: 'relation' };
}

// n nodes of a type, ids `${type}${0..n-1}`.
function nodesOfType(type: string, n: number): GraphNode[] {
  return Array.from({ length: n }, (_, i) => node(`${type}${i}`, type));
}

const TWO_PI = Math.PI * 2;

describe('#290: sector angles proportional to node count', () => {
  it('a type with twice as many nodes gets twice the sector width', () => {
    const nodes = [...nodesOfType('A', 4), ...nodesOfType('B', 2)];
    const sectors = computeRingSectors(nodes, []);
    const byType = new Map(sectors.map((s) => [s.type, s]));
    const wA = byType.get('A')!.endAngle - byType.get('A')!.startAngle;
    const wB = byType.get('B')!.endAngle - byType.get('B')!.startAngle;
    expect(wA).toBeCloseTo(2 * wB, 6);
    expect(wA + wB).toBeCloseTo(TWO_PI, 6);
  });
});

describe('#290: all nodes of a type land inside that type sector', () => {
  it('every node angle is within its type wedge', () => {
    const nodes = [...nodesOfType('A', 6), ...nodesOfType('B', 3), ...nodesOfType('C', 5)];
    const links = [rel('A0', 'B0'), rel('B1', 'C0'), rel('A1', 'A2')];
    const sectors = computeRingSectors(nodes, links);
    const byType = new Map(sectors.map((s) => [s.type, s]));
    const pos = computeRingLayout(nodes, links);
    const EPS = 1e-6;
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const sec = byType.get(n.type)!;
      const mid = (sec.startAngle + sec.endAngle) / 2;
      let a = Math.atan2(p.y, p.x);
      while (a < mid - Math.PI) a += TWO_PI;
      while (a > mid + Math.PI) a -= TWO_PI;
      expect(a).toBeGreaterThanOrEqual(sec.startAngle - EPS);
      expect(a).toBeLessThanOrEqual(sec.endAngle + EPS);
    }
  });
});

describe('#290: seriation places strongly-touching types adjacent', () => {
  it('A-B and C-D each end up next to each other around the ring', () => {
    const nodes = [...nodesOfType('A', 2), ...nodesOfType('B', 2), ...nodesOfType('C', 2), ...nodesOfType('D', 2)];
    const links = [
      rel('A0', 'B0'), rel('A0', 'B1'), rel('A1', 'B0'), rel('A1', 'B1'), rel('A0', 'B1'), // strong A-B
      rel('C0', 'D0'), rel('C0', 'D1'), rel('C1', 'D0'), rel('C1', 'D1'),                   // strong C-D
    ];
    const order = computeRingSectors(nodes, links).map((s) => s.type);
    const n = order.length;
    const adjacent = (x: string, y: string) => {
      const i = order.indexOf(x), j = order.indexOf(y);
      const d = Math.abs(i - j);
      return d === 1 || d === n - 1; // neighbours on the ring (incl. wrap)
    };
    expect(adjacent('A', 'B')).toBe(true);
    expect(adjacent('C', 'D')).toBe(true);
  });
});

describe('#290: deterministic', () => {
  it('two runs on the same input give identical positions', () => {
    const nodes = [...nodesOfType('A', 7), ...nodesOfType('B', 4), ...nodesOfType('C', 9)];
    const links = [rel('A0', 'B0'), rel('A1', 'A3'), rel('B2', 'C4'), rel('C1', 'C8')];
    const a = computeRingLayout(nodes, links);
    const b = computeRingLayout(nodes, links);
    expect(a.size).toBe(b.size);
    for (const [id, p] of a) {
      expect(b.get(id)!.x).toBe(p.x);
      expect(b.get(id)!.y).toBe(p.y);
    }
  });
});

describe('#290: fixed, bounded positions (no live sim drift)', () => {
  it('every node gets a finite position inside the disc radius', () => {
    const nodes = [...nodesOfType('A', 10), ...nodesOfType('B', 10)];
    const links = [rel('A0', 'A1'), rel('B0', 'B1')];
    const R = 500;
    const pos = computeRingLayout(nodes, links, { radius: R });
    expect(pos.size).toBe(nodes.length);
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
      expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(R + 1e-6);
    }
  });

  it('fills the wedge radially — spread across the band, not piled on the rim', () => {
    const nodes = nodesOfType('A', 40);
    const R = 500;
    const pos = computeRingLayout(nodes, [], { radius: R, innerRatio: 0.15 });
    const radii = [...pos.values()].map((p) => Math.hypot(p.x, p.y));
    expect(Math.max(...radii)).toBeGreaterThan(0.6 * R); // reaches the outer edge
    expect(Math.min(...radii)).toBeLessThan(0.4 * R);    // ...and the inner band, not a thin ring
  });

  it('ordered fill lays nodes on concentric rows inside the sector', () => {
    const nodes = [...nodesOfType('A', 30), ...nodesOfType('B', 30)];
    const sectors = computeRingSectors(nodes, []);
    const byType = new Map(sectors.map((s) => [s.type, s]));
    const pos = computeRingLayout(nodes, [], { radius: 500, innerRatio: 0.15 });
    // several distinct radii = several rows (not one blob)
    const radii = new Set([...pos.values()].map((p) => Math.round(Math.hypot(p.x, p.y))));
    expect(radii.size).toBeGreaterThanOrEqual(3);
    // still inside the type wedge
    for (const n of nodes) {
      const p = pos.get(n.id)!;
      const sec = byType.get(n.type)!;
      let a = Math.atan2(p.y, p.x);
      const mid = (sec.startAngle + sec.endAngle) / 2;
      while (a < mid - Math.PI) a += TWO_PI;
      while (a > mid + Math.PI) a -= TWO_PI;
      expect(a).toBeGreaterThanOrEqual(sec.startAngle - 1e-6);
      expect(a).toBeLessThanOrEqual(sec.endAngle + 1e-6);
    }
  });

  it('a single type fills the whole circle (one sector, 2π wide)', () => {
    const nodes = nodesOfType('A', 5);
    const sectors = computeRingSectors(nodes, []);
    expect(sectors).toHaveLength(1);
    expect(sectors[0].endAngle - sectors[0].startAngle).toBeCloseTo(TWO_PI, 6);
  });
});
