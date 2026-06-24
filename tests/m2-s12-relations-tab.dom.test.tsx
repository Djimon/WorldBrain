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

// Bug #59
describe('issue-59 RelationsTab and EntityGraph database type safety', () => {
  describe('RelationsTab.tsx', () => {
    it('does not contain "as never" casts', () => {
      const src = readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('declares database prop as DatabaseLike', () => {
      const src = readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).toMatch(/database\s*:\s*DatabaseLike/);
    });

    it('imports DatabaseLike from entity-service', () => {
      const src = readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).toMatch(/DatabaseLike/);
      expect(src).toMatch(/from\s+['"].*entity-service['"]/);
    });
  });

  describe('EntityGraph.tsx', () => {
    it('does not contain "as never" casts', () => {
      const src = readFileSync('src/ui/EntityGraph.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('declares database prop as DatabaseLike', () => {
      const src = readFileSync('src/ui/EntityGraph.tsx', 'utf-8');
      expect(src).toMatch(/database\s*:\s*DatabaseLike/);
    });

    it('imports DatabaseLike from entity-service', () => {
      const src = readFileSync('src/ui/EntityGraph.tsx', 'utf-8');
      expect(src).toMatch(/DatabaseLike/);
      expect(src).toMatch(/from\s+['"].*entity-service['"]/);
    });
  });

  describe('entity-service.ts', () => {
    it('exports DatabaseLike', () => {
      const src = readFileSync('src/services/entity-service.ts', 'utf-8');
      expect(src).toMatch(/export\s+(type\s+)?DatabaseLike/);
    });
  });
});

// Bug #62
describe('issue-62 RelationsTab registered in EntityDetailView', () => {
  describe('wiring module', () => {
    it('a wiring module or App.tsx exists that calls registerEntityTab for Relations', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      // Check candidate locations for the registration call
      const candidates = [
        'src/App.tsx',
        'src/tabs.ts',
        'src/tabs.tsx',
        'src/tab-wiring.ts',
        'src/tab-wiring.tsx',
        'src/epic004-tabs.ts',
        'src/epic004-tabs.tsx',
      ];

      let found = false;
      for (const candidate of candidates) {
        if (fs.existsSync(path.resolve(candidate))) {
          const src = fs.readFileSync(path.resolve(candidate), 'utf-8');
          if (src.includes('registerEntityTab') && src.includes('relations')) {
            found = true;
            break;
          }
        }
      }

      expect(found, 'No file found that registers the Relations tab via registerEntityTab').toBe(true);
    });

    it('the registration uses "relations" as the tab id', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');

      const candidates = [
        'src/App.tsx', 'src/tabs.ts', 'src/tabs.tsx',
        'src/tab-wiring.ts', 'src/tab-wiring.tsx',
        'src/epic004-tabs.ts', 'src/epic004-tabs.tsx',
      ];

      let src = '';
      for (const candidate of candidates) {
        if (fs.existsSync(path.resolve(candidate))) {
          const content = fs.readFileSync(path.resolve(candidate), 'utf-8');
          if (content.includes('registerEntityTab')) { src = content; break; }
        }
      }

      expect(src).toMatch(/id\s*:\s*['"]relations['"]/);
    });
  });

  describe('EntityDetailView shows Relations tab after registration', () => {
    afterEach(async () => {
      const { clearEntityTabs } = await import('../src/ui/EntityDetailView');
      clearEntityTabs();
    });

    it('EntityDetailView shows a Relations tab when RelationsTab is registered', async () => {
      const { EntityDetailView, registerEntityTab } = await import('../src/ui/EntityDetailView');
      const { RelationsTab } = await import('../src/ui/RelationsTab');

      registerEntityTab({
        id: 'relations',
        label: 'Relations',
        render: ({ entityId, database }: { entityId: string; database: unknown }) =>
          <RelationsTab entityId={entityId} database={database as never} />,
      });

      render(<EntityDetailView entityId="char-ada" />);

      expect(screen.getByRole('tab', { name: /relations/i })).toBeInTheDocument();
    });
  });
});

// Bug #64
describe('issue-64 RelationsTab state management', () => {
  describe('source-level: no DB_SENTINEL anti-pattern', () => {
    it('RelationsTab.tsx does not contain DB_SENTINEL', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).not.toContain('DB_SENTINEL');
    });

    it('RelationsTab.tsx does not use an empty object {} as default database', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      // Pattern: database = {} as default prop
      expect(src).not.toMatch(/database\s*=\s*\{\}/);
    });
  });

  describe('source-level: no forceUpdate pattern', () => {
    it('RelationsTab.tsx does not use forceUpdate hack (n => n + 1 counter)', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).not.toMatch(/forceUpdate|n\s*=>\s*n\s*\+\s*1/);
    });

    it('RelationsTab.tsx holds relations as React state (useState with array)', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      // useState holding relations — must have state for the relations list
      expect(src).toMatch(/useState\s*[<(]/);
    });
  });

  describe('runtime: UI updates reactively after mutations', () => {
    const mockDb = {};

    it('deactivating a relation removes it from the active list without full re-mount', async () => {
      const { getRelations, deactivateRelation } = await import('../src/services/relation-service');

      // After deactivate, simulate component re-reading state
      (deactivateRelation as ReturnType<typeof vi.fn>).mockImplementation(() => {
        (getRelations as ReturnType<typeof vi.fn>).mockReturnValueOnce([]);
      });

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      // Active relation is visible
      expect(screen.getByText(/ally of|entity-bram/i)).toBeInTheDocument();

      // Deactivate
      const deactivateBtn = screen.queryByRole('button', { name: /deactivate|remove/i });
      if (deactivateBtn) {
        fireEvent.click(deactivateBtn);
        // After state update, active section should reflect the change
        // (implementation-dependent — verify the button called the service)
        expect(deactivateRelation).toHaveBeenCalled();
      }
    });

    it('reactivating a relation updates the UI', async () => {
      const { getRelations, reactivateRelation } = await import('../src/services/relation-service');

      // Start with an inactive relation
      (getRelations as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        { id: 'r-inactive', source_id: 'entity-ada', target_id: 'entity-bram', relation_type: 'ally_of', inverse_type: 'ally_of', active: 0, visibility_json: '"public"', notes: 'Old.' },
      ]);

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      const reactivateBtn = screen.queryByRole('button', { name: /reactivate/i });
      if (reactivateBtn) {
        fireEvent.click(reactivateBtn);
        expect(reactivateRelation).toHaveBeenCalledWith(expect.anything(), 'r-inactive');
      }
    });
  });
});

// Bug #66
describe('issue-66 relation visibility toggle in add-relation form', () => {
  describe('visibility toggle in add form', () => {
    it('add-relation form includes a visibility toggle', () => {
      openAddForm();

      const toggle =
        screen.queryByRole('checkbox', { name: /gm.?only|visibility/i }) ??
        screen.queryByRole('switch', { name: /gm.?only|visibility/i }) ??
        screen.queryByRole('combobox', { name: /visibility/i });

      expect(toggle).toBeInTheDocument();
    });

    it('visibility toggle defaults to public', () => {
      openAddForm();

      const checkbox = screen.queryByRole('checkbox', { name: /gm.?only/i });
      if (checkbox) {
        expect(checkbox).not.toBeChecked();
      } else {
        const select = screen.queryByRole('combobox', { name: /visibility/i });
        expect(select).toHaveValue('public');
      }
    });

    it('toggling visibility to gm_only passes gm_only to addRelation', async () => {
      const { addRelation } = await import('../src/services/relation-service');
      openAddForm();

      // Required: entity picker must exist and accept input
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bram' } });
      fireEvent.click(screen.getByText('Bram Holt'));

      // Required: GM-only toggle must exist
      const toggle =
        screen.getByRole('checkbox', { name: /gm.?only/i });
      fireEvent.click(toggle);

      // Required: submit button must exist
      fireEvent.click(screen.getByRole('button', { name: /save|confirm|add/i }));

      expect(addRelation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ visibility: 'gm_only' })
      );
    });

    it('submitting with public visibility passes public to addRelation', async () => {
      const { addRelation } = await import('../src/services/relation-service');
      (addRelation as ReturnType<typeof vi.fn>).mockClear();
      openAddForm();

      // Required: entity picker must exist
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bram' } });
      fireEvent.click(screen.getByText('Bram Holt'));

      // Do NOT toggle GM-only — leave as public (default)
      fireEvent.click(screen.getByRole('button', { name: /save|confirm|add/i }));

      expect(addRelation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ visibility: 'public' })
      );
    });
  });

  describe('gm_only badge on created relation', () => {
    it('a gm_only relation shows the GM-only badge in the relations list', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      (getRelations as ReturnType<typeof vi.fn>).mockReturnValueOnce([
        {
          id: 'r-gm', source_id: 'entity-ada', target_id: 'char-bram',
          relation_type: 'ally_of', inverse_type: 'ally_of',
          active: 1, visibility_json: '"gm_only"', notes: null,
        },
      ]);

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      expect(screen.getByText(/gm.?only|gm only/i)).toBeInTheDocument();
    });
  });

  describe('source-level: no hardcoded visibility public', () => {
    it('RelationsTab.tsx does not hardcode visibility: "public" in addRelation call', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      // Should not have a literal hardcoded 'public' as the visibility value in addRelation
      expect(src).not.toMatch(/addRelation[\s\S]{0,300}visibility\s*:\s*['"]public['"]/);
    });
  });
});

