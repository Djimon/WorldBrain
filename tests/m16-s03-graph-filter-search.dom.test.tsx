// M16-S03 (#324): relation-type filter + name search in the global graph.
// GraphCanvas stubbed (no WebGL) — we assert the links it receives (filter)
// and the focusRequest it receives (search select -> zoom).
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import type { GraphLink } from '../src/services/graph-model';

const gc = vi.hoisted(() => ({ props: null as null | { links: GraphLink[]; focusRequest?: { id: string; nonce: number } } }));
vi.mock('../src/ui/GraphCanvas', () => ({
  GraphCanvas: (props: { links: GraphLink[]; focusRequest?: { id: string; nonce: number } }) => {
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
];
function makeDb(): DatabaseLike {
  return { select: vi.fn(async () => ENTITIES), execute: vi.fn(async () => {}) } as unknown as DatabaseLike;
}

afterEach(() => {
  gc.props = null;
  try { localStorage.clear(); } catch { /* ignore */ }
  vi.clearAllMocks();
});

describe('#324: relation-type filter', () => {
  it('unchecking a relation type removes those edges from the render', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(gc.props?.links.length).toBe(1)); // the knows relation

    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    fireEvent.click(screen.getByLabelText('knows')); // uncheck
    await waitFor(() => expect(gc.props?.links.length).toBe(0)); // relation hidden
  });
});

describe('#324: name search selects + focuses a node', () => {
  it('typing + picking a suggestion sends a focusRequest with that id', async () => {
    render(<GlobalGraphView database={makeDb()} onNavigate={vi.fn()} />);
    await waitFor(() => expect(gc.props).not.toBeNull());

    fireEvent.change(screen.getByLabelText('Suche'), { target: { value: 'Ada' } });
    fireEvent.click(await screen.findByRole('button', { name: /Ada/ }));
    await waitFor(() => expect(gc.props?.focusRequest?.id).toBe('a'));
  });
});
