// M16-S03 (#324): pure styling derivation for the knowledge-graph renderer.
// Testable without a GPU (AC "Testbarkeit — verpflichtend"): nodeStyle/
// edgeStyle/typeColor never touch Pixi — GraphCanvas.tsx consumes them as
// accessor props and only does the (untested-here) draw calls.
import type { GraphLink, GraphNode } from './graph-model';
import { ENTITY_TYPE_COLORS } from '../blocks/entity-type-colors';

// D6: node radius clamp — fixed numbers so test/impl are deterministic.
export const NODE_RADIUS_MIN = 6;
export const NODE_RADIUS_MAX = 22;

// D5: edge width/opacity — relation is opaque + thick, mention is faint +
// thin. Distinguished by width/opacity, never dashing.
export const RELATION_EDGE_WIDTH = 2.5;
export const RELATION_EDGE_ALPHA = 1.0;
export const MENTION_EDGE_WIDTH = 1;
export const MENTION_EDGE_ALPHA = 0.35;

// D10: labels only render once the stage zoom reaches this scale.
export const LABEL_ZOOM_THRESHOLD = 1.0;

// Canonical token (from ENTITY_TYPE_COLORS, src/blocks/entity-type-colors.ts)
// -> Pixi hex color. Single source of truth for the graph renderer; no other
// hex resolution exists for these tokens anywhere else in the app.
export const TYPE_COLOR_TABLE: Record<string, number> = {
  purple: 0x9b59b6,
  teal: 0x1abc9c,
  blue: 0x3498db,
  amber: 0xf1c40f,
  coral: 0xff7f50,
  pink: 0xe91e63,
  gray: 0x95a5a6,
  indigo: 0x6610f2,
  olive: 0x808000,
  green: 0x2ecc71,
};

export interface DegreeRange {
  min: number;
  max: number;
}

export interface NodeVisualStyle {
  color: number;
  radius: number;
}

export interface EdgeVisualStyle {
  width: number;
  alpha: number;
  color: number;
}

// Deterministic string -> unsigned 32-bit hash (no external dep, no Math.random).
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toByte = (v: number) => Math.round((v + m) * 255);
  return (toByte(r) << 16) | (toByte(g) << 8) | toByte(b);
}

// Entity type (e.g. "Character") -> Pixi hex color. Known types resolve via
// ENTITY_TYPE_COLORS' token names + TYPE_COLOR_TABLE. Unknown types (plugin
// types, "Lore", ...) get a deterministic hash-based fallback hue — never
// "colorless", never random per render (same type -> same color always).
export function typeColor(type: string): number {
  const token = ENTITY_TYPE_COLORS[type];
  if (token && TYPE_COLOR_TABLE[token] !== undefined) return TYPE_COLOR_TABLE[token];
  return hslToHex(hashString(type) % 360, 0.55, 0.55);
}

// Radius = degree linearly scaled into [NODE_RADIUS_MIN, NODE_RADIUS_MAX]
// over the observed degree range across the whole graph. An empty graph /
// degree 0 (or a degenerate range where min===max) -> NODE_RADIUS_MIN.
export function nodeStyle(node: GraphNode, degreeRange: DegreeRange): NodeVisualStyle {
  const span = degreeRange.max - degreeRange.min;
  const t = span <= 0 ? 0 : Math.min(1, Math.max(0, (node.degree - degreeRange.min) / span));
  const radius = NODE_RADIUS_MIN + t * (NODE_RADIUS_MAX - NODE_RADIUS_MIN);
  return { color: typeColor(node.type), radius };
}

// relation -> width 2.5 / alpha 1.0 (opaque, full color). mention -> width 1
// / alpha 0.35 (faint, dampened color). Color values are not pinned by the
// AC (only width/alpha are) — relation gets a solid light tone, mention a
// dampened gray, both renderer-neutral hex ints.
const RELATION_EDGE_COLOR = 0xd0d0d0;
const MENTION_EDGE_COLOR = 0x808080;

export function edgeStyle(link: GraphLink): EdgeVisualStyle {
  return link.kind === 'relation'
    ? { width: RELATION_EDGE_WIDTH, alpha: RELATION_EDGE_ALPHA, color: RELATION_EDGE_COLOR }
    : { width: MENTION_EDGE_WIDTH, alpha: MENTION_EDGE_ALPHA, color: MENTION_EDGE_COLOR };
}
