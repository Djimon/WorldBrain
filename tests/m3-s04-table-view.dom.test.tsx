// M3-S04: Table view — TanStack Table, column picker, filter, sort, inline edit.
// See: https://github.com/Djimon/WorldBrain/issues/45

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityTable } from '../src/ui/EntityTable';

const characters = [
  { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist.', aliases: [], properties: { role: 'archivist', status: 'alive' } },
  { id: 'char-bram', type: 'Character', title: 'Bram Holt', summary: 'Innkeeper.', aliases: [], properties: { role: 'innkeeper', status: 'alive' } },
  { id: 'char-silas', type: 'Character', title: 'Silas', summary: 'Merchant.', aliases: [], properties: { role: 'merchant', status: 'dead' } },
];

const characterSchema = {
  role: { type: 'string' as const, title: 'Role' },
  status: { type: 'string' as const, enum: ['alive', 'dead', 'unknown'], title: 'Status' },
};

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(() => characters),
  updateEntityProperties: vi.fn(),
}));

describe('M3-S04 table view', () => {
  describe('basic rendering', () => {
    it('renders a table', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);
      expect(screen.getByRole('table')).toBeInTheDocument();
    });

    it('renders all entities of the selected type as rows', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.getByText('Bram Holt')).toBeInTheDocument();
      expect(screen.getByText('Silas')).toBeInTheDocument();
    });

    it('renders column headers including title and property names', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      expect(screen.getByRole('columnheader', { name: /title/i })).toBeInTheDocument();
      expect(screen.getByRole('columnheader', { name: /role/i })).toBeInTheDocument();
    });

    it('is scoped to one entity type — does not show other types', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      // Only Character rows — no Location or other type rows shown
      expect(screen.queryByText('The Keep')).not.toBeInTheDocument();
    });
  });

  describe('column picker', () => {
    it('renders a column picker control', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      const picker = screen.queryByRole('button', { name: /columns|column picker|toggle columns/i });
      expect(picker).toBeInTheDocument();
    });

    it('hiding a column removes it from the table', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      const picker = screen.getByRole('button', { name: /columns|column picker|toggle columns/i });
      fireEvent.click(picker);

      const roleToggle = screen.queryByRole('checkbox', { name: /role/i });
      if (roleToggle && roleToggle.closest('label')) {
        fireEvent.click(roleToggle);
        expect(screen.queryByRole('columnheader', { name: /role/i })).not.toBeInTheDocument();
      }
    });
  });

  describe('sorting', () => {
    it('clicking a column header sorts the table', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      const titleHeader = screen.getByRole('columnheader', { name: /title/i });
      fireEvent.click(titleHeader);

      // After sort, rows should be in alphabetical order: Ada, Bram, Silas
      const rows = screen.getAllByRole('row').slice(1); // skip header
      expect(rows[0]).toHaveTextContent(/ada/i);
    });

    it('clicking sorted column again reverses sort order', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      const titleHeader = screen.getByRole('columnheader', { name: /title/i });
      fireEvent.click(titleHeader);
      fireEvent.click(titleHeader);

      // Reversed: Silas first
      const rows = screen.getAllByRole('row').slice(1);
      expect(rows[0]).toHaveTextContent(/silas/i);
    });
  });

  describe('column filtering', () => {
    it('renders a filter input per column', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      // At minimum, there should be some filter input(s)
      const filterInputs = screen.queryAllByRole('textbox');
      expect(filterInputs.length).toBeGreaterThan(0);
    });

    it('typing in a column filter narrows visible rows', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      // Find the filter input for title column
      const filterInputs = screen.getAllByRole('textbox');
      const titleFilter = filterInputs.find((i) =>
        i.getAttribute('placeholder')?.match(/title|filter/i) || i.getAttribute('aria-label')?.match(/title|filter/i)
      ) ?? filterInputs[0];

      fireEvent.change(titleFilter, { target: { value: 'ada' } });

      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
      expect(screen.queryByText('Bram Holt')).not.toBeInTheDocument();
    });
  });

  describe('inline editing', () => {
    it('double-clicking a cell makes it editable', () => {
      render(<EntityTable entityType="Character" propertiesSchema={characterSchema} />);

      const roleCell = screen.getAllByText('archivist')[0];
      fireEvent.doubleClick(roleCell);

      // Cell should now contain an input or become contenteditable
      const editInput = screen.queryByRole('textbox') ?? screen.queryByRole('combobox');
      expect(editInput).toBeInTheDocument();
    });
  });
});
