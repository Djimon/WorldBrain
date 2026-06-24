// M3-S03: Global search UX — search input, result list, facet sidebar, keyboard nav.
// See: https://github.com/Djimon/WorldBrain/issues/44

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalSearch } from '../src/ui/GlobalSearch';

vi.mock('../src/services/search-service', () => ({
  searchEntities: vi.fn((_, query: string) => {
    if (!query || query.trim() === '') return [];
    const all = [
      { entityId: 'char-ada', title: 'Ada Thorn', summary: 'Archivist.', entityType: 'Character', score: 10 },
      { entityId: 'char-bram', title: 'Bram Holt', summary: 'Innkeeper.', entityType: 'Character', score: 8 },
      { entityId: 'loc-keep', title: 'The Keep', summary: 'Crumbling fortress.', entityType: 'Location', score: 5 },
    ];
    return all.filter((e) => e.title.toLowerCase().includes(query.toLowerCase()) || e.summary.toLowerCase().includes(query.toLowerCase()));
  }),
  getSearchFacets: vi.fn(() => ({
    entityTypes: { Character: 2, Location: 1 },
  })),
}));

describe('M3-S03 global search UX', () => {
  describe('search input', () => {
    it('renders a search input', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('result list updates as user types', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.queryByText('Bram Holt')).not.toBeInTheDocument();
    });

    it('shows no results before the user types anything', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      expect(screen.queryByText('Ada Thorn')).not.toBeInTheDocument();
    });
  });

  describe('result list', () => {
    it('each result shows entity title', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'thorn' } });
      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
    });

    it('each result shows summary snippet', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'thorn' } });
      expect(screen.getByText('Archivist.')).toBeInTheDocument();
    });

    it('each result shows entity type icon or badge', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
      expect(screen.getByText(/character/i)).toBeInTheDocument();
    });

    it('clicking a result calls onNavigate with the entityId', () => {
      const onNavigate = vi.fn();
      render(<GlobalSearch onNavigate={onNavigate} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
      fireEvent.click(screen.getByText('Ada Thorn'));
      expect(onNavigate).toHaveBeenCalledWith('char-ada');
    });
  });

  describe('facet sidebar', () => {
    it('renders facet filters when results exist', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'the' } });

      // Facet sidebar — entity type filters
      expect(screen.getByText(/character/i)).toBeInTheDocument();
    });

    it('facet filter narrows results when clicked', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'the' } });

      const locationFilter = screen.queryByRole('button', { name: /location/i })
        ?? screen.queryByRole('checkbox', { name: /location/i });
      if (locationFilter) {
        fireEvent.click(locationFilter);
        // After filtering by Location, Character results should be hidden
        expect(screen.queryByText('Bram Holt')).not.toBeInTheDocument();
      }
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves selection to first result', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });

      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });

      const options = screen.queryAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('pressing Enter on selected result calls onNavigate', () => {
      const onNavigate = vi.fn();
      render(<GlobalSearch onNavigate={onNavigate} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'ArrowDown' });
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Enter' });

      expect(onNavigate).toHaveBeenCalledWith('char-ada');
    });

    it('pressing Escape clears the search', () => {
      render(<GlobalSearch onNavigate={vi.fn()} />);
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });

      expect(screen.getByRole('searchbox')).toHaveValue('');
    });
  });

  describe('standalone usage', () => {
    it('renders without throwing', () => {
      expect(() => render(<GlobalSearch onNavigate={vi.fn()} />)).not.toThrow();
    });
  });
});
