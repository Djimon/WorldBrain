// M16-S03 (#324): pure styling derivation for the knowledge-graph renderer.
// Testable without a GPU (AC "Testbarkeit — verpflichtend"): nodeStyle/
// edgeStyle/typeColor never touch Pixi — GraphCanvas.tsx consumes them as
// accessor props and only does the (untested-here) draw calls.
import type { GraphLink, GraphNode } from './graph-model';

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

// Entity type (e.g. "Character") -> Pixi hex color. Known types resolve via
// ENTITY_TYPE_COLORS' token names + TYPE_COLOR_TABLE. Unknown types (plugin
// types, "Lore", ...) get a deterministic hash-based fallback hue — never
// "colorless", never random per render (same type -> same color always).
export function typeColor(_type: string): number {
  throw new Error('not implemented');
}

// Radius = degree linearly scaled into [NODE_RADIUS_MIN, NODE_RADIUS_MAX]
// over the observed degree range across the whole graph. An empty graph /
// degree 0 (or a degenerate range where min===max) -> NODE_RADIUS_MIN.
export function nodeStyle(_node: GraphNode, _degreeRange: DegreeRange): NodeVisualStyle {
  throw new Error('not implemented');
}

// relation -> width 2.5 / alpha 1.0 (opaque, full color). mention -> width 1
// / alpha 0.35 (faint, dampened color).
export function edgeStyle(_link: GraphLink): EdgeVisualStyle {
  throw new Error('not implemented');
}
