// M16-S05 (#290): Ring/disc mode — deterministic radial arrangement.
// Pure layout logic (positions), no three.js/GPU, no own renderer
// (D12: the same GraphCanvas as S03, just a different layout-config prop with
// fixed positions instead of a running force).
//
// Design: planning/research/graph-ring-disc-design.md
//   - Areas = entity type, one FILLED wedge (circle sector) per type.
//   - Sector angle proportional to the node count (sum 360°).
//   - Sector order by touch seriation (strongly connected types
//     adjacent), deterministic.
//   - Within a wedge: force blob per type (intra-type edges -> connected nodes
//     clump), then bounding-box-normalized and mapped area-covering into the wedge
//     (angle x equal-area radius). The area is filled, not the
//     edge -- adjacency from the blob is preserved.
//   - No degree radius. Computed once -> fixed positions.
import { forceLink, forceManyBody, forceSimulation } from 'd3-force';
import type { SimulationLinkDatum, SimulationNodeDatum } from 'd3-force';
import type { GraphLink, GraphNode } from './graph-model';

export interface RingSector {
  type: string;
  count: number;
  startAngle: number; // radians, in [0, 2π)
  endAngle: number;   // startAngle + width (may reach exactly 2π for the last)
}

export interface RingLayoutOptions {
  seed?: number;
  ticks?: number;
  radius?: number;      // outer radius R
  innerRatio?: number;  // rInner = innerRatio * R (empty core)
  chargeStrength?: number;
  linkDistance?: number;
}

// Outer disc radius in layout units. Exported so callers (area labels) can
// place things at the disc edge in the same space the positions use.
export const RING_RADIUS = 500;

const DEFAULT_SEED = 1;
const DEFAULT_TICKS = 300;
const DEFAULT_RADIUS = RING_RADIUS;
const DEFAULT_INNER_RATIO = 0.15;
const DEFAULT_CHARGE_STRENGTH = -120;
const DEFAULT_LINK_DISTANCE = 30;
const GAP_ANGLE = 0.05;        // ~3° guard band per wedge side (empty zone between areas)
const GAP_MAX_RATIO = 0.2;     // ...but never eat more than 20% of a small wedge
const TAU = Math.PI * 2;

// Seedable PRNG (mulberry32) — deterministic init + deterministic jiggle for
// d3-force, so the same input always yields the same positions.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function idSort(a: GraphNode, b: GraphNode): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Split `n` seats across rings weighted by `weights` (arc length), integers
// summing exactly to n (largest-remainder, deterministic tie-break by index).
function apportion(weights: number[], n: number): number[] {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const exact = weights.map((w) => (w / sum) * n);
  const seats = exact.map((e) => Math.floor(e));
  let rest = n - seats.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => (b.frac !== a.frac ? b.frac - a.frac : a.i - b.i));
  for (let k = 0; k < byFrac.length && rest > 0; k++, rest--) seats[byFrac[k].i] += 1;
  return seats;
}

function typeCounts(nodes: GraphNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const n of nodes) counts.set(n.type, (counts.get(n.type) ?? 0) + 1);
  return counts;
}

// type×type "touch" matrix: number of links whose endpoints are of different
// types (both link kinds count). Symmetric.
function affinityMatrix(nodes: GraphNode[], links: GraphLink[]): Map<string, Map<string, number>> {
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const m = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string) => {
    const row = m.get(a) ?? m.set(a, new Map()).get(a)!;
    row.set(b, (row.get(b) ?? 0) + 1);
  };
  for (const l of links) {
    const ta = typeById.get(l.source), tb = typeById.get(l.target);
    if (ta == null || tb == null || ta === tb) continue;
    bump(ta, tb);
    bump(tb, ta);
  }
  return m;
}

// Greedy nearest-neighbour seriation: place strongly-touching types next to
// each other around the ring. Deterministic — start = highest total affinity
// (tie-break type name), then repeatedly append the unplaced type with the
// highest affinity to the current end (tie-break total affinity, then name).
function seriate(types: string[], affinity: Map<string, Map<string, number>>): string[] {
  if (types.length <= 2) return [...types].sort();
  const total = new Map<string, number>();
  for (const t of types) {
    let s = 0;
    for (const v of (affinity.get(t)?.values() ?? [])) s += v;
    total.set(t, s);
  }
  const better = (a: string, b: string, aff: number, bff: number): boolean => {
    if (aff !== bff) return aff > bff;                       // more touch wins
    const ta = total.get(a)!, tb = total.get(b)!;
    if (ta !== tb) return ta > tb;                           // then better connected
    return a < b;                                            // then name (stable)
  };
  const remaining = new Set(types);
  let start = types[0];
  for (const t of types) if (better(t, start, total.get(t)!, total.get(start)!)) start = t;
  const order = [start];
  remaining.delete(start);
  while (remaining.size > 0) {
    const last = order[order.length - 1];
    const row = affinity.get(last);
    let pick: string | null = null;
    let pickAff = -1;
    for (const t of remaining) {
      const aff = row?.get(t) ?? 0;
      if (pick == null || better(t, pick, aff, pickAff)) { pick = t; pickAff = aff; }
    }
    order.push(pick!);
    remaining.delete(pick!);
  }
  return order;
}

// Angular sectors, width proportional to node count, ordered by seriation.
export function computeRingSectors(nodes: GraphNode[], links: GraphLink[]): RingSector[] {
  const counts = typeCounts(nodes);
  const total = nodes.length;
  if (total === 0) return [];
  const order = seriate([...counts.keys()], affinityMatrix(nodes, links));
  const sectors: RingSector[] = [];
  let acc = 0;
  for (const type of order) {
    const count = counts.get(type)!;
    const width = (count / total) * TAU;
    sectors.push({ type, count, startAngle: acc, endAngle: acc + width });
    acc += width;
  }
  return sectors;
}

interface BlobNode extends SimulationNodeDatum {
  id: string;
  x: number;
  y: number;
}

// Deterministic ring layout: fixed position per id. Computed once, meant to be
// frozen (fx/fy) by the caller — filters only hide, never relayout.
export function computeRingLayout(
  nodes: GraphNode[],
  links: GraphLink[],
  options: RingLayoutOptions = {},
): Map<string, { x: number; y: number }> {
  const {
    seed = DEFAULT_SEED,
    ticks = DEFAULT_TICKS,
    radius = DEFAULT_RADIUS,
    innerRatio = DEFAULT_INNER_RATIO,
    chargeStrength = DEFAULT_CHARGE_STRENGTH,
    linkDistance = DEFAULT_LINK_DISTANCE,
  } = options;

  const out = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return out;

  const sectors = computeRingSectors(nodes, links);
  const sectorByType = new Map(sectors.map((s) => [s.type, s]));
  const rInner = innerRatio * radius;
  const rInner2 = rInner * rInner;
  const band = radius * radius - rInner2;

  const byType = new Map<string, GraphNode[]>();
  for (const n of nodes) (byType.get(n.type) ?? byType.set(n.type, []).get(n.type)!).push(n);
  for (const arr of byType.values()) arr.sort(idSort);

  // intra-type links only: the sub-grouping force stays inside each wedge.
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const intraByType = new Map<string, { source: string; target: string }[]>();
  for (const l of links) {
    const t = typeById.get(l.source);
    if (t != null && t === typeById.get(l.target)) {
      (intraByType.get(t) ?? intraByType.set(t, []).get(t)!).push({ source: l.source, target: l.target });
    }
  }

  const rng = mulberry32(seed);
  for (const [type, arr] of byType) {
    const sec = sectorByType.get(type)!;
    const width = sec.endAngle - sec.startAngle;

    // Per-type 2D force blob: connected nodes cluster, charge spreads them out.
    const blob: BlobNode[] = arr.map((n) => ({ id: n.id, x: (rng() - 0.5) * 200, y: (rng() - 0.5) * 200 }));
    const intra = (intraByType.get(type) ?? []) as unknown as SimulationLinkDatum<BlobNode>[];
    forceSimulation<BlobNode>(blob)
      .randomSource(mulberry32(seed + 1)) // deterministic jiggle for coincident nodes
      .force('charge', forceManyBody<BlobNode>().strength(chargeStrength))
      .force('link', forceLink<BlobNode, SimulationLinkDatum<BlobNode>>(intra).id((d) => d.id).distance(linkDistance))
      .stop()
      .tick(ticks);

    // empty guard band between areas so neighbouring wedges don't touch/merge.
    const gap = Math.min(GAP_ANGLE, width * GAP_MAX_RATIO);
    const a0 = sec.startAngle + gap;
    const aw = Math.max(0, (sec.endAngle - gap) - a0);

    // Parliament seat lattice: concentric rows, seats per row proportional to
    // arc length -> uniform density. The blob only orders the nodes (sort by
    // x, tie by id) so connected clusters stay contiguous in the seating.
    const order = blob.slice().sort((p, q) => (p.x !== q.x ? p.x - q.x : (p.id < q.id ? -1 : 1)));
    const nT = order.length;
    const areaPerNode = (0.5 * aw * band) / nT;         // annular-sector area / n
    const cell = Math.sqrt(Math.max(1e-6, areaPerNode));
    const rows = Math.max(1, Math.round((radius - rInner) / cell));
    const dr = (radius - rInner) / rows;
    const rowR: number[] = [];
    const weights: number[] = [];
    for (let i = 0; i < rows; i++) { const ri = rInner + (i + 0.5) * dr; rowR.push(ri); weights.push(ri * aw); }
    const seats = apportion(weights, nT);
    let t = 0;
    for (let i = 0; i < rows; i++) {
      const si = seats[i];
      for (let j = 0; j < si; j++) {
        const angle = si === 1 ? a0 + aw / 2 : a0 + ((j + 0.5) / si) * aw;
        const r = rowR[i];
        out.set(order[t++].id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      }
    }
  }
  return out;
}
