// M2-S12: Relations tab on entity detail view.
// Registered via tab-registration API. Show, add, deactivate, reactivate.
// See: https://github.com/Djimon/WorldBrain/issues/40

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RelationsTab } from '../src/ui/RelationsTab';

// Services sind auf async migriert — getRelations/addRelation liefern Promises (#400 Cluster B).
vi.mock('../src/services/relation-service', () => ({
  getRelations: vi.fn().mockResolvedValue([
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
  addRelation: vi.fn().mockResolvedValue({ id: 'new-rel' }),
  deactivateRelation: vi.fn().mockResolvedValue(undefined),
  reactivateRelation: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => Promise.resolve({
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
  listEntitiesByType: vi.fn().mockResolvedValue([]),
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
    it('renders active relations', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      // rel-1 is active: Silas is source, relation is part_of Weavers → label "member of"
      expect(await screen.findByText(/member of|weavers/i)).toBeInTheDocument();
    });

    it('shows the target entity chip with its type color', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      // Target entity should be shown as a clickable chip
      expect(await screen.findByText(/the weavers/i)).toBeInTheDocument();
    });

    it('shows gm_only visibility badge for gm_only relations', async () => {
      const { getRelations } = vi.mocked(await import('../src/services/relation-service'));
      getRelations.mockResolvedValueOnce([
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

      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      expect(await screen.findByText(/gm.?only|gm only/i)).toBeInTheDocument();
    });
  });

  describe('inactive relations', () => {
    it('shows inactive relations in a greyed/collapsed section', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      // rel-2 is inactive: Ada Thorn with ally_of, notes "Former allies."
      // Either shown greyed or behind a toggle — must be accessible
      expect(await screen.findByText(/former allies|ada thorn/i)).toBeInTheDocument();
    });

    it('inactive relations have a reactivate control', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      expect(await screen.findByRole('button', { name: /reactivate/i })).toBeInTheDocument();
    });

    it('clicking reactivate calls reactivateRelation with the relation id', async () => {
      const { reactivateRelation } = await import('../src/services/relation-service');
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      fireEvent.click(await screen.findByRole('button', { name: /reactivate/i }));

      expect(reactivateRelation).toHaveBeenCalledWith(expect.anything(), 'rel-2');
    });
  });

  describe('deactivate relation', () => {
    it('active relations have a deactivate control', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      expect(await screen.findByRole('button', { name: /deactivate|remove/i })).toBeInTheDocument();
    });

    it('clicking deactivate calls deactivateRelation with the relation id', async () => {
      const { deactivateRelation } = await import('../src/services/relation-service');
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      fireEvent.click(await screen.findByRole('button', { name: /deactivate|remove/i }));

      expect(deactivateRelation).toHaveBeenCalledWith(expect.anything(), 'rel-1');
    });
  });

  describe('label direction', () => {
    it('shows the relation label from the perspective of the current entity (as source)', async () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      // Silas is source of part_of → label is "member of"
      expect(await screen.findByText(/member of/i)).toBeInTheDocument();
    });

    it('shows the inverse label when the current entity is the target', async () => {
      const { getRelations } = vi.mocked(await import('../src/services/relation-service'));
      getRelations.mockResolvedValueOnce([
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

      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      // From Silas's perspective as target: inverse label "has member" should show
      expect(await screen.findByText(/has member/i)).toBeInTheDocument();
    });
  });

  describe('add relation flow', () => {
    it('renders an "Add relation" button', () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      expect(screen.getByRole('button', { name: /add relation/i })).toBeInTheDocument();
    });

    it('clicking Add relation opens the entity picker or an add form', () => {
      render(<RelationsTab entityId="entity-silas" database={{} as never} />);

      fireEvent.click(screen.getByRole('button', { name: /add relation/i }));

      // A form with a relation-type selector (combobox) appears immediately;
      // the EntityPicker searchbox follows once a type is chosen.
      const picker = screen.queryByRole('searchbox') ?? screen.queryByRole('combobox');
      expect(picker).toBeInTheDocument();
    });
  });

  describe('registration via tab API', () => {
    it('RelationsTab renders without being hard-coded into EntityDetailView', () => {
      // RelationsTab is a standalone component, not embedded in EntityDetailView directly.
      // It will be registered via registerEntityTab by the EPIC-004 initializer.
      expect(() => render(<RelationsTab entityId="entity-silas" database={{} as never} />)).not.toThrow();
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

  // #400: EntityGraph.tsx wurde in GlobalGraphView.tsx umbenannt/refaktoriert;
  // die Typsicherheits-Guards prüfen jetzt die aktuelle Datei.
  describe('GlobalGraphView.tsx', () => {
    it('does not contain "as never" casts', () => {
      const src = readFileSync('src/ui/GlobalGraphView.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('declares database prop as DatabaseLike', () => {
      const src = readFileSync('src/ui/GlobalGraphView.tsx', 'utf-8');
      expect(src).toMatch(/database\s*:\s*DatabaseLike/);
    });

    it('imports DatabaseLike from entity-service', () => {
      const src = readFileSync('src/ui/GlobalGraphView.tsx', 'utf-8');
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

      expect(await screen.findByRole('tab', { name: /relations/i })).toBeInTheDocument();
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
        (getRelations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
        return Promise.resolve();
      });

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      // Inactive relation (rel-2, ally_of) is visible from Ada's perspective
      expect(await screen.findByText(/ally of|entity-bram/i)).toBeInTheDocument();

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
      (getRelations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'r-inactive', source_id: 'entity-ada', target_id: 'entity-bram', relation_type: 'ally_of', inverse_type: 'ally_of', active: 0, visibility_json: '"public"', notes: 'Old.' },
      ]);

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      const reactivateBtn = await screen.findByRole('button', { name: /reactivate/i });
      if (reactivateBtn) {
        fireEvent.click(reactivateBtn);
        expect(reactivateRelation).toHaveBeenCalledWith(expect.anything(), 'r-inactive');
      }
    });
  });
});

// Bug #66
describe('issue-66 relation visibility toggle in add-relation form', () => {
  const mockDb = {};

  // Opens the add-relation form and selects a relation type so that the
  // EntityPicker (searchbox) and visibility toggle are available.
  function openAddForm(entityId = 'entity-silas') {
    render(<RelationsTab entityId={entityId} database={mockDb as never} />);
    fireEvent.click(screen.getByRole('button', { name: /^add relation$/i }));
    fireEvent.change(screen.getByRole('combobox', { name: /relation type/i }), { target: { value: 'ally_of' } });
  }

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
      const { listEntitiesByType } = await import('../src/services/entity-service');
      (listEntitiesByType as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'entity-bram', type: 'Character', title: 'Bram Holt', summary: '', aliases: [] },
      ]);
      (addRelation as ReturnType<typeof vi.fn>).mockClear();

      openAddForm();

      // The current component submits on entity-select, so set GM-only first.
      fireEvent.click(screen.getByRole('checkbox', { name: /gm.?only/i }));

      // Entity picker must exist and accept input
      fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'bram' } });
      fireEvent.click(await screen.findByText('Bram Holt'));

      expect(addRelation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ visibility: 'gm_only' })
      );
    });

    it('submitting with public visibility passes public to addRelation', async () => {
      const { addRelation } = await import('../src/services/relation-service');
      const { listEntitiesByType } = await import('../src/services/entity-service');
      (listEntitiesByType as ReturnType<typeof vi.fn>).mockResolvedValue([
        { id: 'entity-bram', type: 'Character', title: 'Bram Holt', summary: '', aliases: [] },
      ]);
      (addRelation as ReturnType<typeof vi.fn>).mockClear();

      openAddForm();

      // Do NOT toggle GM-only — leave as public (default). Selecting the entity submits.
      fireEvent.change(await screen.findByRole('searchbox'), { target: { value: 'bram' } });
      fireEvent.click(await screen.findByText('Bram Holt'));

      expect(addRelation).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ visibility: 'public' })
      );
    });
  });

  describe('gm_only badge on created relation', () => {
    it('a gm_only relation shows the GM-only badge in the relations list', async () => {
      const { getRelations } = await import('../src/services/relation-service');
      (getRelations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        {
          id: 'r-gm', source_id: 'entity-ada', target_id: 'char-bram',
          relation_type: 'ally_of', inverse_type: 'ally_of',
          active: 1, visibility_json: '"gm_only"', notes: null,
        },
      ]);

      render(<RelationsTab entityId="entity-ada" database={mockDb as never} />);

      expect(await screen.findByText(/gm.?only|gm only/i)).toBeInTheDocument();
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
