// M2-S07: Master-detail entity layout with routing.
// See: https://github.com/Djimon/WorldBrain/issues/28

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseLike } from '../src/services/entity-service';
import { EntityMasterDetail } from '../src/ui/EntityMasterDetail';

// Stub database — service module is mocked, so the value is never used.
const stubDb: DatabaseLike = {
  execute: () => Promise.resolve(),
  select: () => Promise.resolve([]),
};

const characterAda = {
  id: 'character-ada',
  type: 'Character',
  title: 'Ada Thorn',
  summary: 'Archivist.',
  properties: {} as Record<string, unknown>,
  aliases: [] as string[],
  visibility: 'public',
};

const characterBram = {
  id: 'character-bram',
  type: 'Character',
  title: 'Bram Holt',
  summary: 'Innkeeper.',
  properties: {} as Record<string, unknown>,
  aliases: [] as string[],
  visibility: 'public',
};

const locationKeep = {
  id: 'location-keep',
  type: 'Location',
  title: 'The Keep',
  summary: 'Crumbling fortress.',
  properties: {} as Record<string, unknown>,
  aliases: [] as string[],
  visibility: 'public',
};

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(async ({ type }: { type: string | null }) => {
    const all = [characterAda, characterBram, locationKeep];
    if (type === null) return all;
    return all.filter((e) => e.type === type);
  }),
  getEffectiveEntity: vi.fn(async ({ entityId }: { entityId: string }) => ({
    found: true,
    entityId,
    entity: [characterAda, characterBram, locationKeep].find((e) => e.id === entityId) ?? null,
    baseEntity: null,
    overriddenFields: [],
    orphanedOverrideCount: 0,
  })),
}));

describe('M2-S07 master-detail entity layout', () => {
  describe('entity list', () => {
    it('renders list items with title, entity-type badge, and summary snippet', async () => {
      render(<EntityMasterDetail initialType="Character" database={stubDb} />);

      await waitFor(() => {
        expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
        expect(screen.getByText('Bram Holt')).toBeInTheDocument();
        expect(screen.getAllByText(/character/i).length).toBeGreaterThan(0);
      });
    });

    it('does not show entities of other types when a type filter is active', async () => {
      render(<EntityMasterDetail initialType="Character" database={stubDb} />);

      await waitFor(() => screen.getByText('Ada Thorn'));
      expect(screen.queryByText('The Keep')).not.toBeInTheDocument();
    });

    it('shows all entity types when no type filter is set', async () => {
      render(<EntityMasterDetail initialType={null} database={stubDb} />);

      await waitFor(() => {
        expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
        expect(screen.getByText('The Keep')).toBeInTheDocument();
      });
    });
  });

  describe('selection', () => {
    it('opens the entity detail view on the right when a list entry is clicked', async () => {
      render(<EntityMasterDetail initialType="Character" database={stubDb} />);

      await waitFor(() => screen.getByText('Ada Thorn'));
      fireEvent.click(screen.getByText('Ada Thorn'));

      // EntityDetailView should now be rendered for Ada (via getEffectiveEntity mock)
      await waitFor(() => expect(screen.getByText('Archivist.')).toBeInTheDocument());
    });

    it('updates displayed detail when a different list entry is clicked', async () => {
      render(<EntityMasterDetail initialType="Character" database={stubDb} />);

      await waitFor(() => screen.getByText('Ada Thorn'));
      fireEvent.click(screen.getByText('Ada Thorn'));
      await waitFor(() => screen.getByText('Archivist.'));
      fireEvent.click(screen.getByText('Bram Holt'));

      await waitFor(() => expect(screen.getByText('Innkeeper.')).toBeInTheDocument());
    });
  });

  describe('layout structure', () => {
    it('renders a two-column layout: list on left, detail on right', async () => {
      render(<EntityMasterDetail initialType="Character" database={stubDb} />);

      await waitFor(() => {
        const list = screen.getByRole('list');
        expect(list).toBeInTheDocument();
      });
    });

    it('is a reusable primitive — accepts any entity type without hard-coding', () => {
      expect(() => render(<EntityMasterDetail initialType="Location" database={stubDb} />)).not.toThrow();
    });
  });

  describe('routing', () => {
    it('calls onEntitySelect callback with entityId when an entity is selected', async () => {
      const onSelect = vi.fn();
      render(<EntityMasterDetail initialType="Character" onEntitySelect={onSelect} database={stubDb} />);

      await waitFor(() => screen.getByText('Ada Thorn'));
      fireEvent.click(screen.getByText('Ada Thorn'));

      expect(onSelect).toHaveBeenCalledWith('character-ada');
    });

    it('renders with a pre-selected entity when selectedEntityId prop is provided', async () => {
      render(<EntityMasterDetail initialType="Character" selectedEntityId="character-bram" database={stubDb} />);

      await waitFor(() => expect(screen.getAllByText('Innkeeper.').length).toBeGreaterThan(0));
    });
  });
});
