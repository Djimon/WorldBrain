// M2-S12: Relations tab on entity detail view.
// Registered via tab-registration API. Show, add, deactivate, reactivate.
// See: https://github.com/Djimon/WorldBrain/issues/40

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelationsTab } from '../src/ui/RelationsTab';

vi.mock('../src/services/relation-service', () => ({
  getRelations: vi.fn(() => [
    {
      id: 'rel-1',
      source_id: 'entity-silas',
      target_id: 'entity-weavers',
      relation_type: 'part_of',
      inverse_type: 'has_part',
      active: 1,
      visibility_json: '"public"',
      notes: null,
    },
    {
      id: 'rel-2',
      source_id: 'entity-silas',
      target_id: 'entity-ada',
      relation_type: 'ally_of',
      inverse_type: 'ally_of',
      active: 0,
      visibility_json: '"public"',
      notes: 'Former allies.',
    },
  ]),
  addRelation: vi.fn(() => ({ id: 'new-rel' })),
  deactivateRelation: vi.fn(),
  reactivateRelation: vi.fn(),
}));

vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => ({
    found: true,
    entityId,
    entity: {
      id: entityId,
      type: 'Character',
      title: entityId === 'entity-weavers' ? 'The Weavers' : entityId === 'entity-ada' ? 'Ada Thorn' : 'Silas',
      summary: 'An entity.',
      aliases: [],
      properties: {},
      body: { format: 'portable_blocks_v1', blocks: [] },
      visibility: 'public',
      created_at: '2026-06-24T00:00:00.000Z',
      updated_at: '2026-06-24T00:00:00.000Z',
    },
    baseEntity: null,
    overriddenFields: [],
    orphanedOverrideCount: 0,
  })),
  listEntitiesByType: vi.fn(() => []),
}));

vi.mock('../src/data/relation-type-registry', () => ({
  getRelationTypeDefinition: vi.fn((type: string) => {
    const defs: Record<string, { label: string; inverse_label: string; symmetry: string }> = {
      part_of: { label: 'member of', inverse_label: 'has member', symmetry: 'directed' },
      ally_of: { label: 'ally of', inverse_label: 'ally of', symmetry: 'symmetric' },
    };
    return defs[type];
  }),
  getAllRelationTypes: vi.fn(() => [
    { relation_type: 'part_of', label: 'member of' },
    { relation_type: 'ally_of', label: 'ally of' },
  ]),
  RelationType: { part_of: 'part_of', ally_of: 'ally_of' },
}));

describe('M2-S12 relations tab', () => {
  describe('active relations', () => {
    it('renders active relations', () => {
      render(<RelationsTab entityId="entity-silas" />);

      // rel-1 is active: Silas is source, relation is part_of Weavers → label "member of"
      expect(screen.getByText(/member of|weavers/i)).toBeInTheDocument();
    });

    it('shows the target entity chip with its type color', () => {
      render(<RelationsTab entityId="entity-silas" />);

      // Target entity should be shown as a clickable chip
      expect(screen.getByText(/the weavers/i)).toBeInTheDocument();
    });

    it('shows gm_only visibility badge for gm_only relations', async () => {
      const { getRelations } = vi.mocked(await import('../src/services/relation-service'));
      getRelations.mockReturnValueOnce([
        {
          id: 'rel-gm',
          source_id: 'entity-silas',
          target_id: 'entity-weavers',
          relation_type: 'knows_secret',
          inverse_type: 'secret_known_by',
          active: 1,
          visibility_json: '"gm_only"',
          notes: null,
        },
      ]);

      render(<RelationsTab entityId="entity-silas" />);

      expect(screen.getByText(/gm.?only|gm only/i)).toBeInTheDocument();
    });
  });

  describe('inactive relations', () => {
    it('shows inactive relations in a greyed/collapsed section', () => {
      render(<RelationsTab entityId="entity-silas" />);

      // rel-2 is inactive: Ada Thorn with ally_of, notes "Former allies."
      // Either shown greyed or behind a toggle — must be accessible
      expect(screen.getByText(/former allies|ada thorn/i)).toBeInTheDocument();
    });

    it('inactive relations have a reactivate control', () => {
      render(<RelationsTab entityId="entity-silas" />);

      expect(screen.getByRole('button', { name: /reactivate/i })).toBeInTheDocument();
    });

    it('clicking reactivate calls reactivateRelation with the relation id', async () => {
      const { reactivateRelation } = await import('../src/services/relation-service');
      render(<RelationsTab entityId="entity-silas" />);

      fireEvent.click(screen.getByRole('button', { name: /reactivate/i }));

      expect(reactivateRelation).toHaveBeenCalledWith(expect.anything(), 'rel-2');
    });
  });

  describe('deactivate relation', () => {
    it('active relations have a deactivate control', () => {
      render(<RelationsTab entityId="entity-silas" />);

      expect(screen.getByRole('button', { name: /deactivate|remove/i })).toBeInTheDocument();
    });

    it('clicking deactivate calls deactivateRelation with the relation id', async () => {
      const { deactivateRelation } = await import('../src/services/relation-service');
      render(<RelationsTab entityId="entity-silas" />);

      fireEvent.click(screen.getByRole('button', { name: /deactivate|remove/i }));

      expect(deactivateRelation).toHaveBeenCalledWith(expect.anything(), 'rel-1');
    });
  });

  describe('label direction', () => {
    it('shows the relation label from the perspective of the current entity (as source)', () => {
      render(<RelationsTab entityId="entity-silas" />);

      // Silas is source of part_of → label is "member of"
      expect(screen.getByText(/member of/i)).toBeInTheDocument();
    });

    it('shows the inverse label when the current entity is the target', async () => {
      const { getRelations } = vi.mocked(await import('../src/services/relation-service'));
      getRelations.mockReturnValueOnce([
        {
          id: 'rel-inv',
          source_id: 'entity-weavers',  // Weavers is source
          target_id: 'entity-silas',    // Silas is target
          relation_type: 'part_of',
          inverse_type: 'has_part',
          active: 1,
          visibility_json: '"public"',
          notes: null,
        },
      ]);

      render(<RelationsTab entityId="entity-silas" />);

      // From Silas's perspective as target: inverse label "has member" should show
      expect(screen.getByText(/has member/i)).toBeInTheDocument();
    });
  });

  describe('add relation flow', () => {
    it('renders an "Add relation" button', () => {
      render(<RelationsTab entityId="entity-silas" />);

      expect(screen.getByRole('button', { name: /add relation/i })).toBeInTheDocument();
    });

    it('clicking Add relation opens the entity picker or an add form', () => {
      render(<RelationsTab entityId="entity-silas" />);

      fireEvent.click(screen.getByRole('button', { name: /add relation/i }));

      // Either an EntityPicker or a form with relation-type selector appears
      const picker = screen.queryByRole('searchbox') ?? screen.queryByRole('combobox');
      expect(picker).toBeInTheDocument();
    });
  });

  describe('registration via tab API', () => {
    it('RelationsTab renders without being hard-coded into EntityDetailView', () => {
      // RelationsTab is a standalone component, not embedded in EntityDetailView directly.
      // It will be registered via registerEntityTab by the EPIC-004 initializer.
      expect(() => render(<RelationsTab entityId="entity-silas" />)).not.toThrow();
    });
  });
});
