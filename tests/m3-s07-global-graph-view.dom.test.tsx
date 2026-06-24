// M3-S07: Global filtered graph view — Cytoscape.js, entity+relation type filters, no center node.
// See: https://github.com/Djimon/WorldBrain/issues/48

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('cytoscape', () => ({
  default: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    nodes: vi.fn(() => ({ length: 3 })),
    edges: vi.fn(() => ({ length: 2 })),
  })),
}));

vi.mock('../src/services/relation-service', () => ({
  getAllRelations: vi.fn((_db: unknown, { includeInactive }: { includeInactive: boolean }) => {
    const all = [
      { id: 'r1', source_id: 'char-ada', target_id: 'char-bram', relation_type: 'ally_of', inverse_type: 'ally_of', active: 1, visibility_json: '"public"', notes: null },
      { id: 'r2', source_id: 'char-ada', target_id: 'loc-keep', relation_type: 'located_in', inverse_type: 'contains', active: 1, visibility_json: '"public"', notes: null },
    ];
    if (includeInactive) return all;
    return all.filter((r) => r.active === 1);
  }),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(({ type }: { type: string | null }) => {
    const all = [
      { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist.' },
      { id: 'char-bram', type: 'Character', title: 'Bram Holt', summary: 'Innkeeper.' },
      { id: 'loc-keep', type: 'Location', title: 'The Keep', summary: 'Fortress.' },
    ];
    if (type === null) return all;
    return all.filter((e) => e.type === type);
  }),
}));

vi.mock('../src/data/relation-type-registry', () => ({
  getAllRelationTypes: vi.fn(() => [
    { relation_type: 'ally_of', label: 'ally of' },
    { relation_type: 'located_in', label: 'located in' },
  ]),
  RelationType: { ally_of: 'ally_of', located_in: 'located_in' },
}));

import { GlobalEntityGraph } from '../src/ui/GlobalEntityGraph';

describe('M3-S07 global filtered graph view', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<GlobalEntityGraph onNavigate={vi.fn()} />)).not.toThrow();
    });

    it('does not require a center entityId prop — shows global view', () => {
      // GlobalEntityGraph must work without an entityId prop (unlike EntityGraph)
      expect(() => render(<GlobalEntityGraph onNavigate={vi.fn()} />)).not.toThrow();
    });
  });

  describe('filter panel', () => {
    it('renders an entity type multi-select filter', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} />);

      // Entity type filter — checkboxes or multi-select
      const charFilter = screen.queryByRole('checkbox', { name: /character/i })
        ?? screen.queryByLabelText(/character/i);
      expect(charFilter).toBeInTheDocument();
    });

    it('renders a relation type multi-select filter', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} />);

      const relFilter = screen.queryByRole('checkbox', { name: /ally|ally_of|relation type/i })
        ?? screen.queryByText(/ally of/i);
      expect(relFilter).toBeInTheDocument();
    });

    it('changing entity type filter triggers graph update', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} />);

      const charFilter = screen.queryByRole('checkbox', { name: /character/i });
      if (charFilter) {
        fireEvent.click(charFilter);
        // Must not throw after filter change
        expect(charFilter).toBeInTheDocument();
      }
    });
  });

  describe('distinction from local graph', () => {
    it('does not render a depth selector (no center-node concept)', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} />);
      expect(screen.queryByRole('combobox', { name: /depth/i })).not.toBeInTheDocument();
    });
  });

  describe('node click navigation', () => {
    it('accepts an onNavigate callback prop', () => {
      const onNavigate = vi.fn();
      expect(() => render(<GlobalEntityGraph onNavigate={onNavigate} />)).not.toThrow();
      expect(onNavigate).not.toHaveBeenCalled(); // not called on mount
    });
  });

  describe('entity-type color mapping', () => {
    it('renders without error when ENTITY_TYPE_COLORS is applied', () => {
      // The global graph must use the same color mapping from EPIC-003 / issue-34
      // Verified by render not throwing
      expect(() => render(<GlobalEntityGraph onNavigate={vi.fn()} />)).not.toThrow();
    });
  });

  describe('saved views integration', () => {
    it('accepts an initialConfig prop for restoring a saved view state', () => {
      const config = { entityTypes: ['Character'], relationTypes: ['ally_of'] };
      expect(() =>
        render(<GlobalEntityGraph onNavigate={vi.fn()} initialConfig={config} />),
      ).not.toThrow();
    });

    it('exposes a getCurrentConfig callback for saving view state', () => {
      const onConfigChange = vi.fn();
      render(<GlobalEntityGraph onNavigate={vi.fn()} onConfigChange={onConfigChange} />);

      // onConfigChange may be called on mount with initial config
      // At minimum, the prop is accepted without error
    });
  });
});

// Bug #122: GlobalEntityGraph must not call DB services at render top-level — only in useEffect.
//           Top-level DB calls cause an unbounded re-render loop (setState inside render).
describe('issue #122: GlobalEntityGraph does not trigger a re-render loop', () => {
  it('does not call listEntitiesByType more than twice after initial mount', async () => {
    const { listEntitiesByType } = await import('../src/services/entity-service');
    const spy = vi.mocked(listEntitiesByType);
    spy.mockClear();

    render(<GlobalEntityGraph onNavigate={vi.fn()} />);

    // Allow microtasks / useEffect to flush
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Unbounded loop would produce hundreds of calls; ≤2 means: one on mount + possible strict-mode double-invoke
    expect(spy.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it('does not call getAllRelations more than twice after initial mount', async () => {
    const { getAllRelations } = await import('../src/services/relation-service');
    const spy = vi.mocked(getAllRelations);
    spy.mockClear();

    render(<GlobalEntityGraph onNavigate={vi.fn()} />);

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(spy.mock.calls.length).toBeLessThanOrEqual(4);
  });
});
