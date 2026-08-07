// M16-S07 (#321): Ego-Graph = the SAME GlobalGraphView, only filtered to the
// focus entity + its 1-hop neighborhood via `egoFocusId`, with edges + bloom
// forced on. No ego-specific renderer. GraphCanvas is stubbed (no WebGL in
// jsdom) — we assert the subgraph + the forced overrides it receives.
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphNode } from '../src/services/graph-model';

const gc = vi.hoisted(() => ({ props: null as null | { nodes: GraphNode[]; edgesHidden?: boolean; glowEnabled?: boolean } }));
vi.mock('../src/ui/GraphCanvas', () => ({
  GraphCanvas: (props: { nodes: GraphNode[]; edgesHidden?: boolean; glowEnabled?: boolean }) => {
    gc.props = props;
    return <div data-testid="gc" data-nodes={props.nodes.length} />;
  },
}));
vi.mock('../src/services/relation-service', () => ({
  getAllRelations: vi.fn(async () => [
    { id: 'r1', source_id: 'a', target_id: 'b', relation_type: 'knows', inverse_type: 'known_by', active: 1, visibility_json: '"public"', notes: null },
  ]),
}));
vi.mock('../src/services/mention-graph', () => ({ buildMentionEdges: vi.fn(() => []) }));

import { GlobalGraphView } from '../src/ui/GlobalGraphView';

const ENTITIES = [
  { id: 'a', type: 'Character', title: 'Ada', summary: '', properties_json: '{}', body_json: '{}' },
  { id: 'b', type: 'Location', title: 'Tavern', summary: '', properties_json: '{}', body_json: '{}' },
  { id: 'c', type: 'Item', title: 'Orphan', summary: '', properties_json: '{}', body_json: '{}' },
];
function makeDb(): DatabaseLike {
  return { select: vi.fn(async () => ENTITIES), execute: vi.fn(async () => {}) } as unknown as DatabaseLike;
}

afterEach(() => { gc.props = null; vi.clearAllMocks(); });

describe('#321: Ego mode of GlobalGraphView (egoFocusId)', () => {
  it('renders only the focus + neighbors, with edges + bloom forced on', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} egoFocusId="a" />);
    await waitFor(() => expect(gc.props).not.toBeNull());
    const p = gc.props!;
    expect(p.nodes.map((n) => n.id).sort()).toEqual(['a', 'b']); // c isolated -> excluded
    expect(p.edgesHidden).toBe(false); // edges always on in ego
    expect(p.glowEnabled).toBe(true);  // bloom always on in ego
  });

  it('full mode (no egoFocusId) renders all nodes', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(gc.props).not.toBeNull());
    expect(gc.props!.nodes.length).toBe(3);
  });
});
