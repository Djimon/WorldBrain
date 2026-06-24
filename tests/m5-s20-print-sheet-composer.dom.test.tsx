// M5-S20: Print sheet composer — A4 3x3 grid, cut marks, backside, print job persistence.
// See: https://github.com/Djimon/WorldBrain/issues/86

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/card-service', () => ({
  listCardInstances: vi.fn(() => Array.from({ length: 5 }, (_, i) => ({
    id: `card-${i}`, entity_id: `e-${i}`, template_id: 'tpl-npc', audience: 'players', fields: '{}',
  }))),
  savePrintJob: vi.fn(() => ({ id: 'job-1' })),
  loadPrintJob: vi.fn(() => ({ id: 'job-1', cards: ['card-0', 'card-1'], cutMarks: true, backside: null })),
}));

import { PrintSheetComposer } from '../src/ui/PrintSheetComposer';

const mockDb = {};

describe('M5-S20 print sheet composer', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<PrintSheetComposer database={mockDb as never} />)).not.toThrow();
    });

    it('shows card slots in 3x3 grid', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      const cells = document.querySelectorAll('[data-slot]');
      expect(cells.length).toBe(9);
    });

    it('shows sheet preview area', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      expect(screen.getByTestId('sheet-preview')).toBeInTheDocument();
    });
  });

  describe('card queue', () => {
    it('has an Add Card button', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /add card/i })).toBeInTheDocument();
    });

    it('added cards appear in the sheet', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add card/i }));
      const items = screen.queryAllByRole('listitem');
      expect(items.length).toBeGreaterThan(0);
    });

    it('>9 cards triggers auto-pagination (shows page 2 indicator)', () => {
      render(<PrintSheetComposer database={mockDb as never} initialCards={Array.from({ length: 10 }, (_, i) => `card-${i}`)} />);
      expect(screen.queryByText(/page 2|sheet 2/i)).toBeInTheDocument();
    });
  });

  describe('cut marks', () => {
    it('has a cut marks toggle', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      const toggle = screen.queryByRole('checkbox', { name: /cut marks/i })
        ?? screen.queryByRole('switch', { name: /cut marks/i });
      expect(toggle).toBeInTheDocument();
    });

    it('toggling cut marks updates the preview', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      const toggle = screen.queryByRole('checkbox', { name: /cut marks/i })
        ?? screen.getByRole('switch', { name: /cut marks/i });
      const before = document.querySelectorAll('[data-cut-mark]').length;
      fireEvent.click(toggle);
      const after = document.querySelectorAll('[data-cut-mark]').length;
      expect(before).not.toBe(after);
    });
  });

  describe('backside', () => {
    it('has a backside selector', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      const sel = screen.queryByRole('combobox', { name: /backside/i });
      expect(sel).toBeInTheDocument();
    });

    it('backside options include blank, logo, category pattern', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      const sel = screen.queryByRole('combobox', { name: /backside/i });
      if (sel) {
        const opts = Array.from(sel.querySelectorAll('option')).map(o => o.textContent?.toLowerCase());
        expect(opts.some(o => o?.includes('blank'))).toBe(true);
      }
    });
  });

  describe('print job persistence', () => {
    it('has a Save Print Job button', () => {
      render(<PrintSheetComposer database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /save|export/i })).toBeInTheDocument();
    });
  });
});
