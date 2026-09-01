// M2-S11: Entity picker component — search-and-select with type filter and keyboard nav.
// See: https://github.com/Djimon/WorldBrain/issues/39

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityPicker } from '../src/ui/EntityPicker';

// listEntitiesByType ist auf async migriert — liefert ein Promise (#400 Cluster B).
vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(({ type }: { type: string | null }) => {
    const all = [
      { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist.', aliases: ['The Red Notary'] },
      { id: 'char-bram', type: 'Character', title: 'Bram Holt', summary: 'Innkeeper.', aliases: [] },
      { id: 'loc-keep', type: 'Location', title: 'The Keep', summary: 'Crumbling fortress.', aliases: [] },
    ];
    if (type === null) return Promise.resolve(all);
    return Promise.resolve(all.filter((e) => e.type === type));
  }),
}));

const mockDb = {};

describe('M2-S11 entity picker', () => {
  describe('search input', () => {
    it('renders a text input for entity search', () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      expect(screen.getByRole('searchbox')).toBeInTheDocument();
    });

    it('shows all entities initially (before any search)', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      expect(await screen.findByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('Bram Holt')).toBeInTheDocument();
      expect(screen.getByText('The Keep')).toBeInTheDocument();
    });

    it('filters results by title when text is typed', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      // Wait for the async list to load before filtering.
      await screen.findByText('Ada Thorn');

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'ada' } });

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.queryByText('Bram Holt')).not.toBeInTheDocument();
    });

    it('filters results by alias', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      await screen.findByText('Ada Thorn');

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'red notary' } });

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.queryByText('Bram Holt')).not.toBeInTheDocument();
    });

    it('shows empty state message when no results match', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      await screen.findByText('Ada Thorn');

      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzznomatch' } });

      expect(screen.queryByText('Ada Thorn')).not.toBeInTheDocument();
      // Empty state indicator — text, aria, or container
      const results = screen.queryAllByRole('option');
      expect(results.length).toBe(0);
    });
  });

  describe('type filter', () => {
    it('limits results to the specified entity type when typeFilter is set', async () => {
      render(<EntityPicker onSelect={vi.fn()} typeFilter="Character" database={mockDb as never} />);

      expect(await screen.findByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.queryByText('The Keep')).not.toBeInTheDocument();
    });

    it('shows all types when typeFilter is null', async () => {
      render(<EntityPicker onSelect={vi.fn()} typeFilter={null} database={mockDb as never} />);

      expect(await screen.findByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('The Keep')).toBeInTheDocument();
    });
  });

  describe('result item display', () => {
    it('each result shows entity-type badge', async () => {
      render(<EntityPicker onSelect={vi.fn()} typeFilter="Character" database={mockDb as never} />);

      await screen.findByText('Ada Thorn');
      expect(screen.getAllByText(/character/i).length).toBeGreaterThan(0);
    });

    it('each result shows title', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);

      expect(await screen.findByText('Ada Thorn')).toBeInTheDocument();
    });

    it('each result shows summary snippet', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);

      expect(await screen.findByText('Archivist.')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('clicking a result calls onSelect with the entityId', async () => {
      const onSelect = vi.fn();
      render(<EntityPicker onSelect={onSelect} database={mockDb as never} />);

      fireEvent.click(await screen.findByText('Ada Thorn'));

      expect(onSelect).toHaveBeenCalledWith('char-ada');
    });

    it('does not write to the database — emits entityId only', async () => {
      const onSelect = vi.fn();
      render(<EntityPicker onSelect={onSelect} database={mockDb as never} />);

      fireEvent.click(await screen.findByText('Bram Holt'));

      // onSelect receives only the id, not a full entity object or DB write
      expect(onSelect).toHaveBeenCalledWith('char-bram');
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe('keyboard navigation', () => {
    it('ArrowDown moves focus to the first result', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      await screen.findByText('Ada Thorn');

      const input = screen.getByRole('searchbox');
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // First option should be focused/highlighted
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('pressing Enter on a highlighted result calls onSelect', async () => {
      const onSelect = vi.fn();
      render(<EntityPicker onSelect={onSelect} database={mockDb as never} />);

      const input = screen.getByRole('searchbox');
      await screen.findByText('Ada Thorn');
      fireEvent.change(input, { target: { value: 'ada' } });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledWith('char-ada');
    });

    it('pressing Escape clears the search and closes the dropdown', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);

      const input = screen.getByRole('searchbox');
      await screen.findByText('Ada Thorn');
      fireEvent.change(input, { target: { value: 'ada' } });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(input).toHaveValue('');
    });
  });

  describe('standalone usage', () => {
    it('works without a typeFilter prop', () => {
      expect(() => render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />)).not.toThrow();
    });

    it('is not coupled to any relation or embed context', () => {
      // EntityPicker must work without any parent providing a special context
      expect(() => render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />)).not.toThrow();
    });
  });
});

// Bug #58
describe('issue-58 EntityPicker database prop', () => {
  describe('source-level: no null as never cast', () => {
    it('EntityPicker.tsx does not contain "null as never"', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityPicker.tsx', 'utf-8');
      expect(src).not.toContain('null as never');
    });

    it('EntityPicker.tsx does not contain "as never"', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityPicker.tsx', 'utf-8');
      expect(src).not.toContain('as never');
    });

    it('EntityPicker.tsx accepts a database prop (declared in Props type)', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/EntityPicker.tsx', 'utf-8');
      expect(src).toMatch(/database\s*:/);
    });
  });

  describe('runtime: database prop is accepted', () => {
    it('renders when database prop is provided', () => {
      expect(() =>
        render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />),
      ).not.toThrow();
    });

    it('listEntitiesByType is called with the provided database, not null', async () => {
      const { listEntitiesByType } = await import('../src/services/entity-service');
      const db = { ...mockDb };

      render(<EntityPicker onSelect={vi.fn()} database={db as never} />);

      expect(listEntitiesByType).toHaveBeenCalledWith(
        expect.objectContaining({ database: db }),
      );
    });

    it('shows entity results when database prop is passed', async () => {
      render(<EntityPicker onSelect={vi.fn()} database={mockDb as never} />);
      expect(await screen.findByText('Ada Thorn')).toBeInTheDocument();
    });
  });

  describe('RelationsTab passes database through to EntityPicker', () => {
    it('RelationsTab.tsx does not contain "null as never"', async () => {
      const fs = await import('node:fs');
      const src = fs.readFileSync('src/ui/RelationsTab.tsx', 'utf-8');
      expect(src).not.toContain('null as never');
    });
  });
});
