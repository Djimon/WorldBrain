// M3-S06: Wiki/Text reading view — read-only body, no editor chrome, toggle to edit.
// See: https://github.com/Djimon/WorldBrain/issues/47

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityReadingView } from '../src/ui/EntityReadingView';

const entityAda = {
  id: 'char-ada',
  type: 'Character',
  title: 'Ada Thorn',
  summary: 'Archivist.',
  aliases: [],
  properties: { role: 'archivist' },
  body: {
    format: 'portable_blocks_v1' as const,
    blocks: [
      { type: 'heading' as const, level: 1 as const, text: 'Ada Thorn' },
      { type: 'paragraph' as const, text: 'She keeps records of everything.' },
    ],
  },
  visibility: 'public' as const,
  created_at: '2026-06-24T00:00:00Z',
  updated_at: '2026-06-24T00:00:00Z',
};

describe('M3-S06 wiki reading view', () => {
  describe('read-only rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />)).not.toThrow();
    });

    it('renders the entity title', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);
      expect(screen.getByText('Ada Thorn')).toBeInTheDocument();
    });

    it('renders the entity body content', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);
      expect(screen.getByText('She keeps records of everything.')).toBeInTheDocument();
    });

    it('does not render an editor toolbar', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);

      // No Bold/Italic toolbar buttons in reading view
      expect(screen.queryByRole('button', { name: /bold/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /italic/i })).not.toBeInTheDocument();
    });

    it('does not render the properties form', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);

      // No form inputs — reading mode has no editable fields
      const inputs = screen.queryAllByRole('textbox');
      // The contenteditable area may count as a textbox in TipTap read-only mode;
      // but there should be no labeled form inputs
      const labeledInputs = inputs.filter((i) => i.getAttribute('aria-label') || i.id);
      expect(labeledInputs.length).toBe(0);
    });

    it('does not render tab navigation', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);
      expect(screen.queryAllByRole('tab')).toHaveLength(0);
    });
  });

  describe('layout', () => {
    it('is full-width — no sidebar', () => {
      const { container } = render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);
      // Sidebar would typically have role="complementary" or a specific class
      expect(container.querySelector('[role="complementary"]')).not.toBeInTheDocument();
    });
  });

  describe('edit toggle', () => {
    it('renders an edit mode toggle button', () => {
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />);
      expect(screen.getByRole('button', { name: /edit|switch to edit/i })).toBeInTheDocument();
    });

    it('clicking the edit toggle calls onEditToggle', () => {
      const onEditToggle = vi.fn();
      render(<EntityReadingView entity={entityAda} onEditToggle={onEditToggle} />);

      fireEvent.click(screen.getByRole('button', { name: /edit|switch to edit/i }));

      expect(onEditToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('navigation', () => {
    it('renders a back/close button for navigation context', () => {
      const onBack = vi.fn();
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} onBack={onBack} />);

      const backButton = screen.queryByRole('button', { name: /back|close|return/i });
      expect(backButton).toBeInTheDocument();
    });

    it('clicking back button calls onBack', () => {
      const onBack = vi.fn();
      render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} onBack={onBack} />);

      fireEvent.click(screen.getByRole('button', { name: /back|close|return/i }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('works without onBack prop (optional)', () => {
      expect(() => render(<EntityReadingView entity={entityAda} onEditToggle={vi.fn()} />)).not.toThrow();
    });
  });
});
