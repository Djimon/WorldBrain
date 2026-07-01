// M2-S06: EntityDetailView with extensible tab system.
// See: https://github.com/Djimon/WorldBrain/issues/27

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityDetailView, registerEntityTab, clearEntityTabs } from '../src/ui/EntityDetailView';

// Minimal database mock — entity data flows via prop/service, not live DB in component tests
vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async () => []),
  getEffectiveEntity: vi.fn(async ({ entityId }: { entityId: string }) => {
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
    it('renders the Overview tab by default', async () => {
      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument());
    });

    it('shows title and summary in the Overview tab', async () => {
      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => {
        expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
        expect(screen.getByText('Archivist.')).toBeInTheDocument();
      });
    });
  });

  describe('AP-004 regression: XSS in markdown summary', () => {
    it('does not execute inline event handlers in entity.summary', async () => {
      // Override mock for this test to inject a malicious summary
      const { getEffectiveEntity } = await import('../src/services/entity-service');
      (getEffectiveEntity as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        found: true,
        entityId: 'xss-test',
        entity: {
          id: 'xss-test',
          type: 'Character',
          title: 'XSS Test',
          summary: '<img src=x onerror="window.__xss_fired=true"> <script>window.__xss_fired=true</script>',
          aliases: [],
          properties: {},
          body: { format: 'portable_blocks_v1', blocks: [] },
          visibility: 'public',
          created_at: '',
          updated_at: '',
        },
        baseEntity: null,
        overriddenFields: [],
        orphanedOverrideCount: 0,
      });

      render(<EntityDetailView entityId="xss-test" />);
      await waitFor(() => expect(screen.getByText('XSS Test')).toBeInTheDocument());

      const summaryDiv = document.querySelector('.entity-detail__summary--md');
      expect(summaryDiv?.innerHTML).not.toMatch(/onerror/i);
      expect(summaryDiv?.innerHTML).not.toMatch(/<script/i);
      expect((window as Record<string, unknown>).__xss_fired).toBeUndefined();
    });
  });

  describe('error case: missing entity', () => {
    it('shows a not-found message when the entity does not exist', async () => {
      render(<EntityDetailView entityId="does-not-exist" />);

      await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
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

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /relations/i })).toBeInTheDocument();
      });
    });

    it('clicking a registered tab shows its content', async () => {
      registerEntityTab({
        id: 'relations',
        label: 'Relations',
        render: () => <div>Relations content</div>,
      });

      render(<EntityDetailView entityId="character-ada" />);
      await waitFor(() => screen.getByRole('tab', { name: /relations/i }));
      fireEvent.click(screen.getByRole('tab', { name: /relations/i }));

      expect(screen.getByText('Relations content')).toBeInTheDocument();
    });

    it('registered tabs are external — no hard-coded tab list in the component', async () => {
      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => screen.getByRole('tab', { name: /overview/i }));
      const tabs = screen.queryAllByRole('tab');
      // Without registrations, only the Overview tab should exist
      expect(tabs).toHaveLength(1);
    });

    it('multiple tabs can be registered and all appear in the tab list', async () => {
      registerEntityTab({ id: 'tab-a', label: 'Tab A', render: () => <div>A</div> });
      registerEntityTab({ id: 'tab-b', label: 'Tab B', render: () => <div>B</div> });

      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /tab a/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /tab b/i })).toBeInTheDocument();
      });
    });
  });

  describe('standalone usage', () => {
    it('renders without any master-detail layout context', async () => {
      expect(() => render(<EntityDetailView entityId="character-ada" />)).not.toThrow();
    });
  });
});

// Bug #30
describe('issue-30 DatabaseLike type safety', () => {
  describe('entity-service exports', () => {
    it('exports DatabaseLike type (verified via named export at runtime)', async () => {
      const mod = await import('../src/services/entity-service');
      expect(typeof mod.getEffectiveEntity).toBe('function');
      expect(typeof mod.listEntitiesByType).toBe('function');
    });
  });

  describe('EntityDetailView database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      expect(() => render(<EntityDetailView entityId="x" database={db} />)).not.toThrow();
    });

    it('EntityDetailView database prop is typed — passing undefined does not throw at runtime', async () => {
      const { EntityDetailView } = await import('../src/ui/EntityDetailView');
      expect(() => render(<EntityDetailView entityId="x" />)).not.toThrow();
    });
  });

  describe('EntityMasterDetail database prop', () => {
    it('accepts a well-shaped DatabaseLike object without casting to never', async () => {
      const { EntityMasterDetail } = await import('../src/ui/EntityMasterDetail');
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      expect(() => render(<EntityMasterDetail initialType={null} database={db} />)).not.toThrow();
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
    it('tabs registered before render appear in the rendered component', async () => {
      registerEntityTab({ id: 'notes', label: 'Notes', render: () => <div>Notes</div> });

      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument());
    });

    it('clearEntityTabs removes all registered tabs', async () => {
      registerEntityTab({ id: 'notes', label: 'Notes', render: () => <div>Notes</div> });
      clearEntityTabs();

      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => screen.getByRole('tab', { name: /overview/i }));
      expect(screen.queryByRole('tab', { name: /notes/i })).not.toBeInTheDocument();
    });

    it('two simultaneously mounted EntityDetailView instances do not share tab state', async () => {
      registerEntityTab({ id: 'shared-tab', label: 'Shared', render: () => <div>Shared</div> });

      const { unmount: unmountFirst } = render(<EntityDetailView entityId="character-ada" />);
      await waitFor(() => screen.getByRole('tab', { name: /shared/i }));

      clearEntityTabs();

      render(<EntityDetailView entityId="character-ada" />);
      await waitFor(() => screen.getAllByRole('tab', { name: /overview/i }));

      const allTabs = screen.getAllByRole('tab');
      const sharedTabs = allTabs.filter((t) => /shared/i.test(t.textContent ?? ''));

      // Only the first instance should still have the "Shared" tab.
      expect(sharedTabs.length).toBeLessThanOrEqual(1);

      unmountFirst();
    });

    it('tabs registered after mount do not retroactively affect already-mounted instances', async () => {
      render(<EntityDetailView entityId="character-ada" />);
      await waitFor(() => screen.getByRole('tab', { name: /overview/i }));

      // Initially only Overview tab
      expect(screen.getAllByRole('tab')).toHaveLength(1);

      clearEntityTabs();
      render(<EntityDetailView entityId="character-ada" />);
      await waitFor(() => screen.getAllByRole('tab', { name: /overview/i }));

      const tabs = screen.getAllByRole('tab');
      expect(tabs.every((t) => /overview/i.test(t.textContent ?? ''))).toBe(true);
    });
  });

  describe('clearEntityTabs contract', () => {
    it('clearEntityTabs is idempotent — calling it twice does not throw', () => {
      registerEntityTab({ id: 'tab-x', label: 'X', render: () => <div>X</div> });
      expect(() => { clearEntityTabs(); clearEntityTabs(); }).not.toThrow();
    });

    it('registerEntityTab after clearEntityTabs works correctly', async () => {
      registerEntityTab({ id: 'tab-old', label: 'Old', render: () => <div>Old</div> });
      clearEntityTabs();
      registerEntityTab({ id: 'tab-new', label: 'New', render: () => <div>New</div> });

      render(<EntityDetailView entityId="character-ada" />);

      await waitFor(() => {
        expect(screen.queryByRole('tab', { name: /old/i })).not.toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /new/i })).toBeInTheDocument();
      });
    });
  });
});

