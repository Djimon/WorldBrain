// M16-S05 (#290): the Galaxy/Disc switch wires the ring layout into the SAME
// GraphCanvas (D12). GraphCanvas is stubbed (no WebGL) — we assert the layout
// mode + positions it receives. "Sim inactive" for ring = fixed positions are
// passed (one per node, flat z=0), so no live force runs in the canvas.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphNode } from '../src/services/graph-model';
import type { GraphLayoutConfig, GraphPosition } from '../src/ui/GraphCanvas';

const gc = vi.hoisted(() => ({
  props: null as null | { nodes: GraphNode[]; positions?: GraphPosition[]; layout?: GraphLayoutConfig },
}));
vi.mock('../src/ui/GraphCanvas', () => ({
  GraphCanvas: (props: { nodes: GraphNode[]; positions?: GraphPosition[]; layout?: GraphLayoutConfig }) => {
    gc.props = props;
    return <div data-testid="gc" />;
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
  { id: 'c', type: 'Character', title: 'Cid', summary: '', properties_json: '{}', body_json: '{}' },
];
function makeDb(): DatabaseLike {
  return { select: vi.fn(async () => ENTITIES), execute: vi.fn(async () => {}) } as unknown as DatabaseLike;
}

afterEach(() => {
  gc.props = null;
  try { localStorage.clear(); } catch { /* ignore */ }
  vi.clearAllMocks();
});

describe('#290: Galaxy/Disc switch', () => {
  it('defaults to galaxy', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(gc.props?.layout?.mode).toBe('galaxy'));
  });

  it('switching to Disc feeds ring mode + fixed flat positions (one per node)', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(gc.props).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Disc' }));

    await waitFor(() => expect(gc.props?.layout?.mode).toBe('ring'));
    const pos = gc.props?.positions ?? [];
    expect(pos).toHaveLength(ENTITIES.length);        // fixed position per node
    expect(pos.every((p) => p.z === 0)).toBe(true);   // flat disc (2D, no z)
  });
});
