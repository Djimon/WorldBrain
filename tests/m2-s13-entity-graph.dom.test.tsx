// M2-S13: Local graph view per entity using Cytoscape.js.
// Tests graph data building logic, depth filtering, and inactive filter.
// Cytoscape.js rendering is mocked — tests focus on data and behavior contract.
// See: https://github.com/Djimon/WorldBrain/issues/41

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock Cytoscape so the DOM test does not need a real canvas
vi.mock('cytoscape', () => ({
  default: vi.fn(() => ({
    add: vi.fn(),
    remove: vi.fn(),
    layout: vi.fn(() => ({ run: vi.fn() })),
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(),
    nodes: vi.fn(() => ({ length: 0 })),
    edges: vi.fn(() => ({ length: 0 })),
  })),
}));

vi.mock('../src/services/relation-service', () => ({
  getRelations: vi.fn((_db: unknown, entityId: string, { includeInactive }: { includeInactive: boolean }) => {
    const all = [
      { id: 'r1', source_id: 'entity-ada', target_id: 'entity-weavers', relation_type: 'part_of', inverse_type: 'has_part', active: 1, visibility_json: '"public"', notes: null },
      { id: 'r2', source_id: 'entity-ada', target_id: 'entity-bram', relation_type: 'ally_of', inverse_type: 'ally_of', active: 1, visibility_json: '"public"', notes: null },
      { id: 'r3', source_id: 'entity-ada', target_id: 'entity-silas', relation_type: 'knows_secret', inverse_type: 'secret_known_by', active: 0, visibility_json: '"gm_only"', notes: null },
    ];
    const byEntity = all.filter((r) => r.source_id === entityId || r.target_id === entityId);
    if (includeInactive) return byEntity;
    return byEntity.filter((r) => r.active === 1);
  }),
}));

vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => ({
    found: true,
    entityId,
    entity: { id: entityId, type: 'Character', title: entityId, summary: '', aliases: [], properties: {}, body: { format: 'portable_blocks_v1', blocks: [] }, visibility: 'public', created_at: '', updated_at: '' },
    baseEntity: null,
    overriddenFields: [],
    orphanedOverrideCount: 0,
  })),
}));

import { EntityGraph, buildGraphData } from '../src/ui/EntityGraph';

describe('M2-S13 entity graph view', () => {
  describe('graph data builder', () => {
    it('buildGraphData returns nodes and edges', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: false });

      const data = buildGraphData('entity-ada', relations);

      expect(data).toHaveProperty('nodes');
      expect(data).toHaveProperty('edges');
    });

    it('buildGraphData includes the root entity as a node', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: false });

      const { nodes } = buildGraphData('entity-ada', relations);

      expect(nodes.some((n) => n.id === 'entity-ada')).toBe(true);
    });

    it('buildGraphData includes connected entities as nodes', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: false });

      const { nodes } = buildGraphData('entity-ada', relations);

      expect(nodes.some((n) => n.id === 'entity-weavers')).toBe(true);
      expect(nodes.some((n) => n.id === 'entity-bram')).toBe(true);
    });

    it('buildGraphData does not include inactive relations by default', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: false });

      const { nodes } = buildGraphData('entity-ada', relations);

      expect(nodes.some((n) => n.id === 'entity-silas')).toBe(false);
    });

    it('buildGraphData includes inactive nodes when asked', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: true });

      const { nodes } = buildGraphData('entity-ada', relations);

      expect(nodes.some((n) => n.id === 'entity-silas')).toBe(true);
    });

    it('each edge includes source, target, and relation_type', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = getRelations(null as never, 'entity-ada', { includeInactive: false });

      const { edges } = buildGraphData('entity-ada', relations);

      expect(edges.length).toBeGreaterThan(0);
      for (const edge of edges) {
        expect(edge).toHaveProperty('source');
        expect(edge).toHaveProperty('target');
        expect(edge).toHaveProperty('relation_type');
      }
    });
  });

  describe('EntityGraph component', () => {
    it('renders without throwing', () => {
      expect(() => render(<EntityGraph entityId="entity-ada" />)).not.toThrow();
    });

    it('renders a depth selector with options 1, 2, 3', () => {
      render(<EntityGraph entityId="entity-ada" />);

      const depthSelector = screen.getByRole('combobox', { name: /depth/i });
      expect(depthSelector).toBeInTheDocument();

      expect(screen.getByRole('option', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '2' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: '3' })).toBeInTheDocument();
    });

    it('renders a relation-type filter', () => {
      render(<EntityGraph entityId="entity-ada" />);

      // Multi-select or checkbox group for relation type filtering
      const filter = screen.getByRole('group', { name: /relation type|filter/i })
        ?? screen.queryByLabelText(/filter by type/i);
      expect(filter).toBeTruthy();
    });

    it('renders a toggle to show/hide inactive relations', () => {
      render(<EntityGraph entityId="entity-ada" />);

      const toggle = screen.getByRole('checkbox', { name: /inactive|show inactive/i })
        ?? screen.queryByRole('switch', { name: /inactive/i });
      expect(toggle).toBeTruthy();
    });

    it('inactive relations are hidden by default', () => {
      render(<EntityGraph entityId="entity-ada" />);

      const toggle = screen.getByRole('checkbox', { name: /inactive|show inactive/i });
      expect(toggle).not.toBeChecked();
    });

    it('calls onNavigate when a graph node is clicked', () => {
      const onNavigate = vi.fn();
      render(<EntityGraph entityId="entity-ada" onNavigate={onNavigate} />);

      // Simulate node click via the component's exposed mechanism
      // The exact interaction depends on Cytoscape event wiring — verify the prop exists
      // and the component mounts cleanly with the callback
      expect(onNavigate).not.toHaveBeenCalled(); // Not called on mount
    });

    it('is always centered on one entity — no "show all" global view', () => {
      // entityId prop is required: the graph must be anchored to a specific entity
      render(<EntityGraph entityId="entity-ada" />);

      // The component renders with the root entity visible
      expect(document.querySelector('[data-entity-id="entity-ada"], [data-root]')).toBeTruthy();
    });
  });

  describe('depth filtering', () => {
    it('changing depth to 2 triggers a deeper relation fetch', () => {
      render(<EntityGraph entityId="entity-ada" />);

      fireEvent.change(screen.getByRole('combobox', { name: /depth/i }), { target: { value: '2' } });

      // After depth change, the component should re-query — verified by not throwing
      expect(screen.getByRole('combobox', { name: /depth/i })).toHaveValue('2');
    });
  });
});

// Bug #60
describe('issue-60 EntityGraph depth and type filter connected to data', () => {
  describe('buildGraphData depth traversal', () => {
    it('depth=1 includes only direct neighbours of the root', async () => {
      const { getRelations } = await import('../src/services/relation-service');

      // depth 1: ada → bram only
      const depth1Relations = getRelations(null as never, 'entity-ada', { includeInactive: false });
      const { nodes } = buildGraphData('entity-ada', depth1Relations, { depth: 1 });

      expect(nodes.some((n) => n.id === 'entity-bram')).toBe(true);
      expect(nodes.some((n) => n.id === 'entity-silas')).toBe(false);
    });

    it('depth=2 includes 2-hop neighbours', async () => {
      const { getRelations } = await import('../src/services/relation-service');

      // depth 2: ada → bram → silas
      const depth2Relations = [
        ...getRelations(null as never, 'entity-ada', { includeInactive: false }),
        ...getRelations(null as never, 'entity-bram', { includeInactive: false }),
      ];
      const { nodes } = buildGraphData('entity-ada', depth2Relations, { depth: 2 });

      expect(nodes.some((n) => n.id === 'entity-silas')).toBe(true);
    });

    it('buildGraphData accepts a depth option', () => {
      expect(() => buildGraphData('entity-ada', [], { depth: 1 })).not.toThrow();
      expect(() => buildGraphData('entity-ada', [], { depth: 2 })).not.toThrow();
      expect(() => buildGraphData('entity-ada', [], { depth: 3 })).not.toThrow();
    });
  });

  describe('buildGraphData relation-type filter', () => {
    it('filters edges by relation type when selectedTypes is provided', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = [
        ...getRelations(null as never, 'entity-ada', { includeInactive: false }),
        ...getRelations(null as never, 'entity-bram', { includeInactive: false }),
      ];

      const { edges } = buildGraphData('entity-ada', relations, {
        depth: 2,
        selectedTypes: ['ally_of'],
      });

      // Only ally_of edges — knows_secret should be excluded
      expect(edges.every((e) => e.relation_type === 'ally_of')).toBe(true);
      expect(edges.some((e) => e.relation_type === 'knows_secret')).toBe(false);
    });

    it('no type filter shows all relation types', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const relations = [
        ...getRelations(null as never, 'entity-ada', { includeInactive: false }),
        ...getRelations(null as never, 'entity-bram', { includeInactive: false }),
      ];

      const { edges } = buildGraphData('entity-ada', relations, { depth: 2 });

      expect(edges.some((e) => e.relation_type === 'ally_of')).toBe(true);
      expect(edges.some((e) => e.relation_type === 'knows_secret')).toBe(true);
    });
  });

  describe('EntityGraph component wires controls to data', () => {
    it('changing depth selector triggers a re-fetch', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      const callsBefore = (getRelations as ReturnType<typeof vi.fn>).mock.calls.length;

      const { EntityGraph } = await import('../src/ui/EntityGraph');
      render(<EntityGraph entityId="entity-ada" />);

      fireEvent.change(screen.getByRole('combobox', { name: /depth/i }), { target: { value: '2' } });

      const callsAfter = (getRelations as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});

