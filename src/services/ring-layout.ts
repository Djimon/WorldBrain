// M16-S05 (#290): Ring/Disc-Modus — deterministische 2D-Radial-Anordnung.
// Reine Layout-Logik (Positionen), kein three.js/GPU, kein eigener Renderer
// (D12: derselbe GraphCanvas wie S03, nur eine andere Layout-Config-Prop mit
// fixen Positionen statt laufender Force).
//
// Design: planning/research/graph-ring-disc-design.md
//   - Areas = Entity-Typ, ein harter Keil je Typ.
//   - Sektor-Winkel proportional zur Knotenzahl (Summe 360°).
//   - Sektor-Reihenfolge per Berührungs-Seriation (stark verbundene Typen
//     benachbart), deterministisch.
//   - Innerhalb Keil: force-basierte Sub-Gruppierung (intra-typ Kanten), nach
//     jedem Tick hart in Sektor-Winkel x [rInner, R] projiziert.
//   - Kein degree-Radius. Einmal berechnet -> fixe Positionen.
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
  innerRatio?: number;  // rInner = innerRatio * R
  chargeStrength?: number;
  linkDistance?: number;
}

const DEFAULT_SEED = 1;
const DEFAULT_TICKS = 300;
const DEFAULT_RADIUS = 500;
const DEFAULT_INNER_RATIO = 0.12;
const DEFAULT_CHARGE_STRENGTH = -120;
const DEFAULT_LINK_DISTANCE = 30;
const TAU = Math.PI * 2;

// Seedable PRNG (mulberry32) — deterministic init + deterministic jiggle for
// d3-force (see simulation.randomSource below), so the same input always
// yields the same positions.
function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function normAngle(a: number): number {
  let x = a % TAU;
  if (x < 0) x += TAU;
  return x;
}

// Distinct types present, each with its node count. Order of first appearance
// does not matter — sectors are (re)ordered by seriation below.
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
    if (ta !== tb) return ta > tb;                            // then better connected
    return a < b;                                            // then name (stable)
  };
  const remaining = new Set(types);
  // deterministic start
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

interface SimNode extends SimulationNodeDatum {
  id: string;
  type: string;
  x: number;
  y: number;
}

// Deterministic ring layout: fixed positions per id. Computed once, meant to be
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
  const rng = mulberry32(seed);

  // nodes grouped by type, stable id-sorted -> deterministic initial angles.
  const byType = new Map<string, GraphNode[]>();
  for (const n of nodes) (byType.get(n.type) ?? byType.set(n.type, []).get(n.type)!).push(n);
  for (const arr of byType.values()) arr.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const simNodes: SimNode[] = [];
  for (const [type, arr] of byType) {
    const sec = sectorByType.get(type)!;
    const width = sec.endAngle - sec.startAngle;
    arr.forEach((n, i) => {
      const angle = sec.startAngle + ((i + 0.5) / arr.length) * width;
      const r = rInner + rng() * (radius - rInner);
      simNodes.push({ id: n.id, type: n.type, x: Math.cos(angle) * r, y: Math.sin(angle) * r });
    });
  }

  // intra-type links only: the sub-grouping force stays inside each wedge.
  // (cross-type touch is expressed by sector adjacency, not by pulling nodes
  // across the hard wedge boundary.)
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const intraLinks = links
    .filter((l) => typeById.get(l.source) === typeById.get(l.target))
    .map((l) => ({ source: l.source, target: l.target })) as unknown as SimulationLinkDatum<SimNode>[];

  const simulation = forceSimulation<SimNode>(simNodes)
    .randomSource(mulberry32(seed + 1)) // deterministic jiggle for coincident nodes
    .force('charge', forceManyBody<SimNode>().strength(chargeStrength))
    .force('link', forceLink<SimNode, SimulationLinkDatum<SimNode>>(intraLinks).id((d) => d.id).distance(linkDistance))
    .stop();

  // Manual tick loop; after each tick hard-project into the node's wedge
  // ([startAngle, endAngle]) and radius band ([rInner, radius]) -> hard sectors,
  // filled disc, positions bounded.
  for (let i = 0; i < ticks; i++) {
    simulation.tick();
    for (const s of simNodes) {
      const sec = sectorByType.get(s.type)!;
      const mid = (sec.startAngle + sec.endAngle) / 2;
      let r = Math.hypot(s.x, s.y);
      if (r < 1e-6) r = rInner;
      // unwrap the angle toward the sector midpoint before clamping, so a node
      // near the 0/2π seam clamps into its wedge and not across it.
      let angle = normAngle(Math.atan2(s.y, s.x));
      while (angle < mid - Math.PI) angle += TAU;
      while (angle > mid + Math.PI) angle -= TAU;
      angle = Math.min(sec.endAngle, Math.max(sec.startAngle, angle));
      r = Math.min(radius, Math.max(rInner, r));
      s.x = Math.cos(angle) * r;
      s.y = Math.sin(angle) * r;
    }
  }

  for (const s of simNodes) out.set(s.id, { x: s.x, y: s.y });
  return out;
}
