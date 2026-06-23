// M2-S07: Master-detail entity layout with routing.
// See: https://github.com/Djimon/WorldBrain/issues/28

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityMasterDetail } from '../src/ui/EntityMasterDetail';

const characterAda = {
  id: 'character-ada',
  type: 'Character',
  title: 'Ada Thorn',
  summary: 'Archivist.',
};

const characterBram = {
  id: 'character-bram',
  type: 'Character',
  title: 'Bram Holt',
  summary: 'Innkeeper.',
};

const locationKeep = {
  id: 'location-keep',
  type: 'Location',
  title: 'The Keep',
  summary: 'Crumbling fortress.',
};

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(({ type }: { type: string | null }) => {
    const all = [characterAda, characterBram, locationKeep];
    if (type === null) return all;
    return all.filter((e) => e.type === type);
  }),
  getEffectiveEntity: vi.fn(({ entityId }: { entityId: string }) => ({
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
    it('renders list items with title, entity-type badge, and summary snippet', () => {
      render(<EntityMasterDetail initialType="Character" />);

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('Bram Holt')).toBeInTheDocument();
      expect(screen.getAllByText(/character/i).length).toBeGreaterThan(0);
    });

    it('does not show entities of other types when a type filter is active', () => {
      render(<EntityMasterDetail initialType="Character" />);

      expect(screen.queryByText('The Keep')).not.toBeInTheDocument();
    });

    it('shows all entity types when no type filter is set', () => {
      render(<EntityMasterDetail initialType={null} />);

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('The Keep')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('opens the entity detail view on the right when a list entry is clicked', () => {
      render(<EntityMasterDetail initialType="Character" />);

      fireEvent.click(screen.getByText('Ada Thorn'));

      // EntityDetailView should now be rendered for Ada
      expect(screen.getByText('Archivist.')).toBeInTheDocument();
    });

    it('updates displayed detail when a different list entry is clicked', () => {
      render(<EntityMasterDetail initialType="Character" />);

      fireEvent.click(screen.getByText('Ada Thorn'));
      fireEvent.click(screen.getByText('Bram Holt'));

      expect(screen.getByText('Innkeeper.')).toBeInTheDocument();
    });
  });

  describe('layout structure', () => {
    it('renders a two-column layout: list on left, detail on right', () => {
      render(<EntityMasterDetail initialType="Character" />);

      const list = screen.getByRole('list');
      expect(list).toBeInTheDocument();
    });

    it('is a reusable primitive — accepts any entity type without hard-coding', () => {
      expect(() => render(<EntityMasterDetail initialType="Location" />)).not.toThrow();
    });
  });

  describe('routing', () => {
    it('calls onEntitySelect callback with entityId when an entity is selected', () => {
      const onSelect = vi.fn();
      render(<EntityMasterDetail initialType="Character" onEntitySelect={onSelect} />);

      fireEvent.click(screen.getByText('Ada Thorn'));

      expect(onSelect).toHaveBeenCalledWith('character-ada');
    });

    it('renders with a pre-selected entity when selectedEntityId prop is provided', () => {
      render(<EntityMasterDetail initialType="Character" selectedEntityId="character-bram" />);

      expect(screen.getByText('Innkeeper.')).toBeInTheDocument();
    });
  });
});
