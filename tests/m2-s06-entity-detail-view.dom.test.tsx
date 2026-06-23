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
