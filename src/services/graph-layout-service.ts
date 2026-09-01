// M16-S10 (#327): precomputed graph-layout positions.
// - computeLayout: headless d3-force simulation until convergence. Deterministic
//   per seed → same input + seed = same positions (cacheable).
// - structureHash: stable signature from node ids + edges for the cache key.
// 2D case (today): positions carry only x/y. The 3D case follows the renderer
// result from S00b (#326) — the same function, then extended with z.
//
// Deliberately NO web-worker wiring here (Node test env). The consumer
// wraps the call in a worker; the function stays pure data processing.
import {
  forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation,
} from 'd3-force';
import type { DatabaseLike } from './entity-service';

export interface LayoutNode { id: string }
export interface LayoutEdge { source: string; target: string }
export interface LayoutModel {
  nodes: readonly LayoutNode[];
  edges: readonly LayoutEdge[];
}
export interface LayoutOptions {
  seed: number;
  /** Fixed number of ticks until "convergence" — deterministic. */
  ticks?: number;
}
export interface LayoutPosition {
  x: number;
  y: number;
}

// Deterministic PRNG (Mulberry32) — d3-force's `.randomSource` requires
// a function that returns [0,1). Same seed → same sequence →
// reproducible start positions and thus a reproducible layout.
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface D3Node { id: string; x?: number; y?: number }
interface D3Link { source: string; target: string }

/**
 * Runs the force simulation headless (no renderer) for a fixed number of
 * ticks. Returns a stable node→position map.
 */
export async function computeLayout(model: LayoutModel, opts: LayoutOptions): Promise<Map<string, LayoutPosition>> {
  const rand = mulberry32(opts.seed);
  const ticks = opts.ticks ?? 300;
  // Start positions from the PRNG — otherwise d3-force's internal Math.random
  // would break the determinism guarantee (our setter only covers the force's own
  // random usage).
  const nodes: D3Node[] = model.nodes.map((n) => ({
    id: n.id,
    x: (rand() - 0.5) * 200,
    y: (rand() - 0.5) * 200,
  }));
  const links: D3Link[] = model.edges.map((e) => ({ source: e.source, target: e.target }));

  const sim: Simulation<D3Node, D3Link> = forceSimulation(nodes)
    .randomSource(rand)
    .force('charge', forceManyBody().strength(-30))
    .force('link', forceLink<D3Node, D3Link>(links).id((n) => n.id).distance(30))
    .force('center', forceCenter(0, 0))
    .force('x', forceX(0).strength(0.05))
    .force('y', forceY(0).strength(0.05))
    .stop();

  for (let i = 0; i < ticks; i += 1) sim.tick();

  const result = new Map<string, LayoutPosition>();
  for (const n of nodes) {
    result.set(n.id, { x: n.x ?? 0, y: n.y ?? 0 });
  }
  return result;
}

/**
 * Structure hash: stable signature from sorted node ids + sorted
 * directed edges. Same graph → same hash (cache hit). If the structure
 * changes → hash changes → recompute.
 */
export function structureHash(model: LayoutModel): string {
  const ids = model.nodes.map((n) => n.id).slice().sort();
  const edges = model.edges.map((e) => `${e.source}${e.target}`).slice().sort();
  const src = `${ids.join('')}${edges.join('')}`;
  // FNV-1a 32-bit — fast + uniformly distributed enough for cache keys, no
  // crypto requirement. Byte-exact deterministic, no environment dependency.
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// M16-S10 cache layer: DB persistence for precomputed positions.
// Consumer flow: (1) hash = structureHash(model); (2) getCachedLayout(db, hash);
//   → if Map: render directly, no recompute. → if null: run computeLayout,
//     saveCachedLayout(db, hash, result). The worker wrapper is the
//     consumer's concern (renderer-dependent, S00b/#326).
// ---------------------------------------------------------------------------

interface CacheRow { positions_json: string }

export async function getCachedLayout(
  db: DatabaseLike, hash: string,
): Promise<Map<string, LayoutPosition> | null> {
  const rows = await db.select<CacheRow>(
    'SELECT positions_json FROM graph_layout_cache WHERE structure_hash = ?',
    [hash],
  );
  if (rows.length === 0) return null;
  try {
    const parsed = JSON.parse(rows[0].positions_json) as Array<[string, LayoutPosition]>;
    return new Map(parsed);
  } catch {
    return null;
  }
}

export async function saveCachedLayout(
  db: DatabaseLike, hash: string, positions: Map<string, LayoutPosition>,
): Promise<void> {
  const serialized = JSON.stringify(Array.from(positions.entries()));
  await db.execute(
    `INSERT INTO graph_layout_cache (structure_hash, positions_json)
     VALUES (?, ?)
     ON CONFLICT(structure_hash) DO UPDATE SET positions_json = excluded.positions_json`,
    [hash, serialized],
  );
}

/**
 * All-in-one: returns cached positions if present; otherwise computes
 * headless + persists. Consumers that want to use the cache reach for
 * this instead of computeLayout directly — the `simCalls` counter serves
 * the test to verify that a cache hit does NOT start the sim again.
 */
let simCalls = 0;
export function _getSimCalls(): number { return simCalls; }
export function _resetSimCalls(): void { simCalls = 0; }

export async function loadOrComputeLayout(
  db: DatabaseLike, model: LayoutModel, opts: LayoutOptions,
): Promise<Map<string, LayoutPosition>> {
  const hash = structureHash(model);
  const cached = await getCachedLayout(db, hash);
  if (cached !== null) return cached;
  simCalls += 1;
  const positions = await computeLayout(model, opts);
  await saveCachedLayout(db, hash, positions);
  return positions;
}
