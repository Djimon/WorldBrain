// M16-S10 (#327): Vorberechnete Graph-Layout-Positionen.
// - computeLayout: headless d3-force-Simulation bis Konvergenz. Deterministisch
//   per Seed → gleiche Eingabe + Seed = gleiche Positionen (cachebar).
// - structureHash: stabile Signatur aus Node-Ids + Kanten für Cache-Schlüssel.
// 2D-Fall (heute): Positionen tragen nur x/y. 3D-Fall folgt dem Renderer-
// Ergebnis aus S00b (#326) — dieselbe Funktion, ergänzt dann z.
//
// Bewusst KEINE Web-Worker-Verdrahtung hier (Node-Test-Env). Der Consumer
// wickelt den Aufruf in einen Worker; die Funktion bleibt reine Datenverarb.
import {
  forceCenter, forceLink, forceManyBody, forceSimulation, forceX, forceY,
  type Simulation,
} from 'd3-force';

export interface LayoutNode { id: string }
export interface LayoutEdge { source: string; target: string }
export interface LayoutModel {
  nodes: readonly LayoutNode[];
  edges: readonly LayoutEdge[];
}
export interface LayoutOptions {
  seed: number;
  /** Fest gewählte Anzahl von Ticks bis „Konvergenz" — deterministisch. */
  ticks?: number;
}
export interface LayoutPosition {
  x: number;
  y: number;
}

// Deterministischer PRNG (Mulberry32) — d3-force's `.randomSource` verlangt
// eine Funktion, die [0,1) zurückgibt. Gleicher Seed → gleiche Sequenz →
// reproduzierbare Startpositionen und damit reproduzierbares Layout.
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
 * Läuft die Force-Simulation headless (kein Renderer) für eine feste Zahl
 * Ticks. Gibt eine stabile Node→Position-Map zurück.
 */
export async function computeLayout(model: LayoutModel, opts: LayoutOptions): Promise<Map<string, LayoutPosition>> {
  const rand = mulberry32(opts.seed);
  const ticks = opts.ticks ?? 300;
  // Startpositionen aus dem PRNG — sonst würde d3-force's interner Math.random
  // die Determinismus-Garantie brechen (unser Setter deckt nur die Force-eigene
  // Zufalls-Nutzung ab).
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
 * Struktur-Hash: stabile Signatur aus sortierten Node-Ids + sortierten
 * gerichteten Kanten. Gleicher Graph → gleicher Hash (Cache-Hit). Ändert
 * sich Struktur → Hash ändert sich → Recompute.
 */
export function structureHash(model: LayoutModel): string {
  const ids = model.nodes.map((n) => n.id).slice().sort();
  const edges = model.edges.map((e) => `${e.source}${e.target}`).slice().sort();
  const src = `${ids.join('')}${edges.join('')}`;
  // FNV-1a 32-bit — schnell + gleichverteilt genug für Cache-Keys, keine
  // Krypto-Anforderung. Byte-genau deterministisch, keine Umgebungsabhängigkeit.
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i += 1) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
