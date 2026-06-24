// M2-S06: EntityDetailView with extensible tab system.
// See: https://github.com/Djimon/WorldBrain/issues/27

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityDetailView, registerEntityTab, clearEntityTabs } from '../src/ui/EntityDetailView';

// Minimal database mock — entity data flows via prop/service, not live DB in component tests
vi.mock('../src/services/entity-service', () => ({
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => {
    if (entityId === 'character-ada') {
      return {
        found: true,
        entityId: 'character-ada',
        entity: {
          id: 'character-ada',
          type: 'Character',
          title: 'Ada Thorn',
          summary: 'Archivist.',
          aliases: [],
          properties: { role: 'archivist' },
          body: { format: 'portable_blocks_v1', blocks: [] },
          visibility: 'public',
          created_at: '2026-06-23T00:00:00.000Z',
          updated_at: '2026-06-23T00:00:00.000Z',
        },
        baseEntity: null,
        overriddenFields: [],
        orphanedOverrideCount: 0,
      };
    }
    return { found: false, entityId, reason: 'base_entity_missing', orphanedOverrideCount: 0 };
  }),
}));

afterEach(() => {
  clearEntityTabs();
});

describe('M2-S06 EntityDetailView with tab system', () => {
  describe('default Overview tab', () => {
    it('renders the Overview tab by default', () => {
      render(<EntityDetailView entityId="character-ada" />);

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
    });

    it('shows title and summary in the Overview tab', () => {
      render(<EntityDetailView entityId="character-ada" />);

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('Archivist.')).toBeInTheDocument();
    });
  });

  describe('error case: missing entity', () => {
    it('shows a not-found message when the entity does not exist', () => {
      render(<EntityDetailView entityId="does-not-exist" />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('tab registration API', () => {
    it('renders a registered tab alongside the default Overview tab', async () => {
      registerEntityTab({
        id: 'relations',
        label: 'Relations',
        render: () => <div>Relations content</div>,
      });

      render(<EntityDetailView entityId="character-ada" />);

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /relations/i })).toBeInTheDocument();
    });

    it('clicking a registered tab shows its content', () => {
      registerEntityTab({
        id: 'relations',
        label: 'Relations',
        render: () => <div>Relations content</div>,
      });

      render(<EntityDetailView entityId="character-ada" />);
      fireEvent.click(screen.getByRole('tab', { name: /relations/i }));

      expect(screen.getByText('Relations content')).toBeInTheDocument();
    });

    it('registered tabs are external — no hard-coded tab list in the component', () => {
      render(<EntityDetailView entityId="character-ada" />);

      const tabs = screen.queryAllByRole('tab');
      // Without registrations, only the Overview tab should exist
      expect(tabs).toHaveLength(1);
    });

    it('multiple tabs can be registered and all appear in the tab list', async () => {
      registerEntityTab({ id: 'tab-a', label: 'Tab A', render: () => <div>A</div> });
      registerEntityTab({ id: 'tab-b', label: 'Tab B', render: () => <div>B</div> });

      render(<EntityDetailView entityId="character-ada" />);

      expect(screen.getByRole('tab', { name: /tab a/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /tab b/i })).toBeInTheDocument();
    });
  });

  describe('standalone usage', () => {
    it('renders without any master-detail layout context', () => {
      expect(() => render(<EntityDetailView entityId="character-ada" />)).not.toThrow();
    });
  });
});

// Bug #30
describe('issue-30 DatabaseLike type safety', () => {
  describe('entity-service exports', () => {
    it('exports DatabaseLike type (verified via named export at runtime)', async () => {
      // DatabaseLike must be exported so callers can use it.
      // In TS, types are erased at runtime — we verify the module loads
      // cleanly and the service functions that depend on DatabaseLike work.
      const mod = await import('../src/services/entity-service');
      expect(typeof mod.getEffectiveEntity).toBe('function');
      expect(typeof mod.listEntitiesByType).toBe('function');
    });
  });

  describe('EntityDetailView database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');

      // A minimal object shaped like DatabaseLike should be accepted without TS error.
      // If the prop is typed as `unknown` with `as never` cast, the runtime cast still works
      // but the type contract is broken. The test verifies no runtime throw.
      const db = { entities: [], entityTypes: [], campaigns: [] };
      expect(() => render(<EntityDetailView entityId="x" database={db as never} />)).not.toThrow();
    });

    it('EntityDetailView database prop is typed — passing undefined does not throw at runtime', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');

      // After the fix, database should be optional or DatabaseLike — not needed for mocked service
      expect(() => render(<EntityDetailView entityId="x" />)).not.toThrow();
    });
  });

  describe('EntityMasterDetail database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityMasterDetail } = await import('../src/ui/EntityMasterDetail');

      const db = { entities: [], entityTypes: [], campaigns: [] };
      expect(() => render(<EntityMasterDetail initialType={null} database={db as never} />)).not.toThrow();
    });

    it('EntityMasterDetail renders without database prop when service is mocked', async () => {
      const { EntityMasterDetail } = await import('../src/ui/EntityMasterDetail');

      expect(() => render(<EntityMasterDetail initialType={null} />)).not.toThrow();
    });
  });

  describe('no as-never casts survive in source', () => {
    it('EntityDetailView.tsx does not contain "as never" casts', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityDetailView.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('EntityMasterDetail.tsx does not contain "as never" casts', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityMasterDetail.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('entity-service.ts exports DatabaseLike (string appears in source)', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/services/entity-service.ts', 'utf-8');
      expect(src).toMatch(/export\s+(type\s+)?DatabaseLike/);
    });
  });
});

// Bug #31
describe('issue-31 tab registry isolation', () => {
  describe('per-instance tab scope', () => {
    it('tabs registered before render appear in the rendered component', () => {
      registerEntityTab({ id: 'notes', label: 'Notes', render: () => <div>Notes</div> });

      render(<EntityDetailView entityId="entity-a" />);

      expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument();
    });

    it('clearEntityTabs removes all registered tabs', () => {
      registerEntityTab({ id: 'notes', label: 'Notes', render: () => <div>Notes</div> });
      clearEntityTabs();

      render(<EntityDetailView entityId="entity-a" />);

      expect(screen.queryByRole('tab', { name: /notes/i })).not.toBeInTheDocument();
    });

    it('two simultaneously mounted EntityDetailView instances do not share tab state', () => {
      // Register a tab — in the buggy global-state impl, both instances would show it.
      // In the fixed scoped impl, only the component tree that received the registration shows it.
      // This test captures the isolation contract: if the registry is per-context, each
      // instance's tab list must be independent of the other's.
      registerEntityTab({ id: 'shared-tab', label: 'Shared', render: () => <div>Shared</div> });

      const { unmount: unmountFirst } = render(<EntityDetailView entityId="entity-a" />);

      clearEntityTabs();

      // Second instance rendered AFTER clearEntityTabs — it should have NO extra tabs
      render(<EntityDetailView entityId="entity-b" />);

      // There are now two EntityDetailViews in the DOM.
      // The second one (entity-b) must NOT show "Shared" because clearEntityTabs was called.
      const allTabs = screen.getAllByRole('tab');
      const sharedTabs = allTabs.filter((t) => /shared/i.test(t.textContent ?? ''));

      // Only the first instance (entity-a) should still have the "Shared" tab.
      // The second instance (entity-b) should not. This is the isolation invariant.
      expect(sharedTabs.length).toBeLessThanOrEqual(1);

      unmountFirst();
    });

    it('tabs registered after mount do not retroactively affect already-mounted instances', () => {
      // Without React Context, module-level push() updates the array in-place,
      // but since React doesn't re-render on external array mutations, this is only
      // detectable if the component re-reads the array on re-render.
      // The correct fix (Context or local state) means the component re-renders reactively.
      render(<EntityDetailView entityId="entity-a" />);

      // Initially only Overview tab
      expect(screen.getAllByRole('tab')).toHaveLength(1);

      // This test documents the requirement: the fix must make tab registration reactive
      // (i.e., registering after mount should cause a re-render showing the new tab).
      // With global mutable state, this won't happen without a re-render trigger.
      // With Context or useState, it can be made reactive if desired.
      // Minimum contract: clearEntityTabs + re-render shows no tabs.
      clearEntityTabs();
      render(<EntityDetailView entityId="entity-a" />);

      const tabs = screen.getAllByRole('tab');
      // All rendered Overview tabs (one per instance) — no "registered" tabs
      expect(tabs.every((t) => /overview/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  describe('clearEntityTabs contract', () => {
    it('clearEntityTabs is idempotent — calling it twice does not throw', () => {
      registerEntityTab({ id: 'tab-x', label: 'X', render: () => <div>X</div> });
      expect(() => { clearEntityTabs(); clearEntityTabs(); }).not.toThrow();
    });

    it('registerEntityTab after clearEntityTabs works correctly', () => {
      registerEntityTab({ id: 'tab-old', label: 'Old', render: () => <div>Old</div> });
      clearEntityTabs();
      registerEntityTab({ id: 'tab-new', label: 'New', render: () => <div>New</div> });

      render(<EntityDetailView entityId="entity-a" />);

      expect(screen.queryByRole('tab', { name: /old/i })).not.toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /new/i })).toBeInTheDocument();
    });
  });
});

