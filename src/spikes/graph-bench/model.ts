// M16-S00b (#326) OPEN renderer bench — throwaway PoC, not a production path.
// Shared, renderer-neutral data model + synthetic generator. Every adapter
// (three/pixi/sigma) renders the SAME {nodes, links} so the comparison
// measures the renderer, not the data.

export interface BenchNode {
  id: string;
  type: string;
  degree: number;
}

export interface BenchLink {
  source: string;
  target: string;
  kind: 'relation' | 'mention';
}

export interface BenchModel {
  nodes: BenchNode[];
  links: BenchLink[];
}

// 8 entity-type buckets — mirrors the epic's "cluster by type" (D3). Pastel
// hex per type, reused by every adapter so colors match across engines.
export const BENCH_TYPES = [
  'Character', 'Location', 'Faction', 'Item',
  'Event', 'Lore', 'Creature', 'Concept',
] as const;

export const BENCH_TYPE_COLORS: Record<string, number> = {
  Character: 0x6cb8f0,
  Location: 0x8fd97a,
  Faction: 0xf07ad0,
  Item: 0xf5923e,
  Event: 0xf2c94c,
  Lore: 0xb39df5,
  Creature: 0xf0716a,
  Concept: 0xa8cdec,
};

// Deterministic RNG (mulberry32) — same graph every run at a given size, so
// repeated fps measurements are comparable and not skewed by layout luck.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// nodeCount nodes, ~edgeFactor edges per node (3-5x is the epic's target).
// ~75% of edges stay inside a type (gives the force sim its clusters), the
// rest cross types. ~80% relation / ~20% mention (D5 dual encoding).
export function generateBenchGraph(nodeCount: number, edgeFactor = 4): BenchModel {
  const rand = mulberry32(0x9e3779b1 ^ nodeCount);
  const nodes: BenchNode[] = [];
  const byType: Record<string, number[]> = {};
  for (const t of BENCH_TYPES) byType[t] = [];

  for (let i = 0; i < nodeCount; i++) {
    const type = BENCH_TYPES[Math.floor(rand() * BENCH_TYPES.length)];
    nodes.push({ id: `n${i}`, type, degree: 0 });
    byType[type].push(i);
  }

  const degree = new Int32Array(nodeCount);
  const links: BenchLink[] = [];
  const seen = new Set<string>();
  const targetEdges = Math.floor(nodeCount * edgeFactor);

  let guard = targetEdges * 4;
  while (links.length < targetEdges && guard-- > 0) {
    const a = Math.floor(rand() * nodeCount);
    let b: number;
    if (rand() < 0.75) {
      const pool = byType[nodes[a].type];
      b = pool[Math.floor(rand() * pool.length)];
    } else {
      b = Math.floor(rand() * nodeCount);
    }
    if (a === b) continue;
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kind: BenchLink['kind'] = rand() < 0.8 ? 'relation' : 'mention';
    links.push({ source: nodes[a].id, target: nodes[b].id, kind });
    degree[a]++;
    degree[b]++;
  }

  for (let i = 0; i < nodeCount; i++) nodes[i].degree = degree[i];
  return { nodes, links };
}
