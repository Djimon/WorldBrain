// M16-S07 (#321): Ego-Graph tab shows only the focus entity + its N-hop
// neighborhood (a BFS subgraph), rendered through the shared GraphCanvas.
// GraphCanvas is stubbed (no WebGL in jsdom) — we assert the SUBGRAPH the tab
// hands it. AP-005 ESM import; AP-008 anchored RTL.
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphNode } from '../src/services/graph-model';

const gc = vi.hoisted(() => ({ lastNodes: [] as GraphNode[] }));
vi.mock('../src/ui/GraphCanvas', () => ({
  GraphCanvas: (props: { nodes: GraphNode[] }) => {
    gc.lastNodes = props.nodes;
    return <div data-testid="gc" data-nodes={props.nodes.length} />;
  },
}));
vi.mock('../src/services/relation-service', () => ({
  getAllRelations: vi.fn(async () => [
    { id: 'r1', source_id: 'a', target_id: 'b', relation_type: 'knows', inverse_type: 'known_by', active: 1, visibility_json: '"public"', notes: null },
  ]),
}));
vi.mock('../src/services/mention-graph', () => ({ buildMentionEdges: vi.fn(() => []) }));

import { EntityGraphTab } from '../src/ui/EntityGraphTab';

const ENTITIES = [
  { id: 'a', type: 'Character', title: 'Ada', summary: '', properties_json: '{}', body_json: '{}' },
  { id: 'b', type: 'Location', title: 'Tavern', summary: '', properties_json: '{}', body_json: '{}' },
  { id: 'c', type: 'Item', title: 'Orphan', summary: '', properties_json: '{}', body_json: '{}' },
];
function makeDb(): DatabaseLike {
  return { select: vi.fn(async () => ENTITIES), execute: vi.fn(async () => {}) } as unknown as DatabaseLike;
}

afterEach(() => { gc.lastNodes = []; vi.clearAllMocks(); });

describe('#321: Ego-Graph tab', () => {
  it('renders only the focus + its neighbors (isolated nodes excluded)', async () => {
    render(<EntityGraphTab entityId="a" database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('gc')).toBeInTheDocument());
    // a (focus) + b (neighbor); c is isolated -> excluded
    expect(screen.getByTestId('gc').getAttribute('data-nodes')).toBe('2');
    const ids = gc.lastNodes.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b']);
  });

  it('offers depth controls (1/2/3)', async () => {
    render(<EntityGraphTab entityId="a" database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('gc')).toBeInTheDocument());
    for (const d of ['1', '2', '3']) {
      expect(screen.getByRole('button', { name: d })).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    // still contains the focus after depth change
    await waitFor(() => expect(gc.lastNodes.map((n) => n.id)).toContain('a'));
  });
});
