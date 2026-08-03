// @vitest-environment node
// M16-S03: Graph-Renderer-Styling — typeColor/nodeStyle/edgeStyle (#324)
// See: https://github.com/Djimon/WorldBrain/issues/324
//
// "Testbarkeit — verpflichtend": Styling muss pure und ohne GPU prüfbar
// sein. Diese Datei prüft genau das — kein Pixi-Import, keine Mounts.
// AP-005: ESM import only, no require().

import { describe, expect, it } from 'vitest';
import {
  edgeStyle, MENTION_EDGE_ALPHA, MENTION_EDGE_WIDTH, NODE_RADIUS_MAX, NODE_RADIUS_MIN,
  nodeStyle, RELATION_EDGE_ALPHA, RELATION_EDGE_WIDTH, TYPE_COLOR_TABLE, typeColor,
} from '../src/services/graph-style';
import type { GraphLink, GraphNode } from '../src/services/graph-model';

function node(overrides: Partial<GraphNode> = {}): GraphNode {
  return { id: 'e1', type: 'Character', label: 'Ada', degree: 0, ...overrides };
}

describe('M16-S03 typeColor', () => {
  it('resolves a known entity type to its canonical table hex (Character -> purple)', () => {
    expect(typeColor('Character')).toBe(TYPE_COLOR_TABLE.purple);
  });

  it('resolves every core ENTITY_TYPE_COLORS token to its table entry', () => {
    expect(typeColor('Location')).toBe(TYPE_COLOR_TABLE.teal);
    expect(typeColor('Faction')).toBe(TYPE_COLOR_TABLE.blue);
    expect(typeColor('Item')).toBe(TYPE_COLOR_TABLE.amber);
    expect(typeColor('Event')).toBe(TYPE_COLOR_TABLE.coral);
    expect(typeColor('Quest')).toBe(TYPE_COLOR_TABLE.pink);
    expect(typeColor('Scene')).toBe(TYPE_COLOR_TABLE.gray);
    expect(typeColor('Rule')).toBe(TYPE_COLOR_TABLE.indigo);
    expect(typeColor('Resource')).toBe(TYPE_COLOR_TABLE.olive);
    expect(typeColor('Culture')).toBe(TYPE_COLOR_TABLE.green);
  });

  it('an unknown type (not in the table) gets a deterministic hash fallback, never "colorless"', () => {
    const color = typeColor('Lore');
    expect(typeof color).toBe('number');
    expect(Number.isFinite(color)).toBe(true);
  });

  it('the same unknown type always yields the same color (stable, not random per render)', () => {
    expect(typeColor('SomePluginType')).toBe(typeColor('SomePluginType'));
  });

  it('two different unknown types get (with overwhelming likelihood) different colors', () => {
    expect(typeColor('PluginTypeA')).not.toBe(typeColor('PluginTypeB'));
  });
});

describe('M16-S03 nodeStyle: radius scales with degree, clamped [6,22]', () => {
  it('color always comes from typeColor(node.type)', () => {
    const style = nodeStyle(node({ type: 'Character' }), { min: 0, max: 10 });
    expect(style.color).toBe(typeColor('Character'));
  });

  it('degree 0 in an otherwise-empty range (min===max===0) clamps to NODE_RADIUS_MIN', () => {
    const style = nodeStyle(node({ degree: 0 }), { min: 0, max: 0 });
    expect(style.radius).toBe(NODE_RADIUS_MIN);
  });

  it('the minimum observed degree maps to NODE_RADIUS_MIN', () => {
    const style = nodeStyle(node({ degree: 1 }), { min: 1, max: 9 });
    expect(style.radius).toBe(NODE_RADIUS_MIN);
  });

  it('the maximum observed degree maps to NODE_RADIUS_MAX', () => {
    const style = nodeStyle(node({ degree: 9 }), { min: 1, max: 9 });
    expect(style.radius).toBe(NODE_RADIUS_MAX);
  });

  it('a mid-range degree maps linearly between min and max radius', () => {
    // degree 5 is exactly halfway between min=1 and max=9.
    const style = nodeStyle(node({ degree: 5 }), { min: 1, max: 9 });
    expect(style.radius).toBe((NODE_RADIUS_MIN + NODE_RADIUS_MAX) / 2);
  });

  it('radius is never rendered outside the clamp, even for an out-of-range degree', () => {
    const style = nodeStyle(node({ degree: 999 }), { min: 0, max: 10 });
    expect(style.radius).toBeLessThanOrEqual(NODE_RADIUS_MAX);
    expect(style.radius).toBeGreaterThanOrEqual(NODE_RADIUS_MIN);
  });
});

describe('M16-S03 edgeStyle: relation vs. mention (D5)', () => {
  function link(overrides: Partial<GraphLink> = {}): GraphLink {
    return { source: 'e1', target: 'e2', kind: 'relation', ...overrides };
  }

  it('relation link: width 2.5, alpha 1.0 (opaque)', () => {
    const style = edgeStyle(link({ kind: 'relation' }));
    expect(style.width).toBe(RELATION_EDGE_WIDTH);
    expect(style.alpha).toBe(RELATION_EDGE_ALPHA);
    expect(style.width).toBe(2.5);
    expect(style.alpha).toBe(1.0);
  });

  it('mention link: width 1, alpha 0.35 (faint)', () => {
    const style = edgeStyle(link({ kind: 'mention' }));
    expect(style.width).toBe(MENTION_EDGE_WIDTH);
    expect(style.alpha).toBe(MENTION_EDGE_ALPHA);
    expect(style.width).toBe(1);
    expect(style.alpha).toBe(0.35);
  });

  it('relation edges are visually heavier than mention edges (width AND alpha)', () => {
    const relation = edgeStyle(link({ kind: 'relation' }));
    const mention = edgeStyle(link({ kind: 'mention' }));
    expect(relation.width).toBeGreaterThan(mention.width);
    expect(relation.alpha).toBeGreaterThan(mention.alpha);
  });
});
