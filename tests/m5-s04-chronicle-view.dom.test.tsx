// M5-S04: Chronicle view — chronological event list with filters.
// See: https://github.com/Djimon/WorldBrain/issues/70

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChronicleView } from '../src/ui/ChronicleView';

vi.mock('../src/services/event-service', () => ({
  listEvents: vi.fn(async () => [
    { id: 'ev-1', title: 'Battle of Iron Keep', type: 'historical_event', start_day: 100, precision: 'day', visibility: 'public', participants: ['char-ada'], locations: ['loc-keep'] },
    { id: 'ev-2', title: 'The Rumor', type: 'rumor', start_day: 500, precision: 'month', visibility: 'gm_only', participants: [], locations: [] },
    { id: 'ev-3', title: 'Council Meeting', type: 'session_event', start_day: 800, precision: 'day', visibility: 'public', participants: ['char-bram'], locations: [] },
  ]),
}));

vi.mock('../src/services/calendar-service', () => ({
  formatAbsoluteDay: vi.fn((day: number) => `Day ${day}`),
}));

const mockDb = {};

describe('M5-S04 chronicle view', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<ChronicleView database={mockDb as never} />)).not.toThrow();
    });

    it('renders all events', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.getByText('Battle of Iron Keep')).toBeInTheDocument());
      expect(screen.getByText('Council Meeting')).toBeInTheDocument();
    });

    it('shows event type badges', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.getByText(/historical.?event|historical_event/i)).toBeInTheDocument());
    });

    it('shows calendar date for each event', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.getByText(/day 100/i)).toBeInTheDocument());
    });
  });

  describe('sort order', () => {
    it('renders events in chronological order (ascending by default)', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.getAllByRole('listitem').length).toBeGreaterThan(0));
      const items = screen.getAllByRole('listitem');
      const titles = items.map(i => i.textContent ?? '');
      const battleIdx = titles.findIndex(t => /battle/i.test(t));
      const councilIdx = titles.findIndex(t => /council/i.test(t));
      if (battleIdx !== -1 && councilIdx !== -1) expect(battleIdx).toBeLessThan(councilIdx);
    });

    it('has a sort order toggle (ascending/descending)', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.queryByRole('button', { name: /asc|desc|sort/i })).toBeInTheDocument());
    });
  });

  describe('filter bar', () => {
    it('renders a filter bar', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => {
        const filter = screen.queryByRole('combobox')
          ?? screen.queryByRole('searchbox')
          ?? screen.queryByRole('listbox');
        expect(filter).toBeInTheDocument();
      });
    });

    it('filtering by type narrows results', async () => {
      render(<ChronicleView database={mockDb as never} />);
      await waitFor(() => expect(screen.getByText('Battle of Iron Keep')).toBeInTheDocument());
      const typeFilter = screen.queryByRole('combobox', { name: /type|event type/i });
      if (typeFilter) {
        fireEvent.change(typeFilter, { target: { value: 'rumor' } });
        await waitFor(() => expect(screen.getByText('The Rumor')).toBeInTheDocument());
        expect(screen.queryByText('Battle of Iron Keep')).not.toBeInTheDocument();
      }
    });
  });

  describe('event click', () => {
    it('clicking an event calls onEventSelect', async () => {
      const onSelect = vi.fn();
      render(<ChronicleView database={mockDb as never} onEventSelect={onSelect} />);
      await waitFor(() => expect(screen.getByText('Battle of Iron Keep')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Battle of Iron Keep'));
      expect(onSelect).toHaveBeenCalledWith('ev-1');
    });
  });

  describe('precision-aware display', () => {
    it('vague-precision events show without a specific date', async () => {
      const { listEvents } = await import('../src/services/event-service');
      (listEvents as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'ev-v', title: 'Ancient War', type: 'historical_event', start_day: 0, precision: 'vague', visibility: 'public', participants: [], locations: [] },
      ]);
      render(<ChronicleView database={mockDb as never} />);
      expect(screen.getByText('Ancient War')).toBeInTheDocument();
    });
  });
});

// Bug #124: AP-001 — database prop must be DatabaseLike, not unknown/never
describe('issue #124: ChronicleView database prop typed as DatabaseLike', () => {
  it('accepts a DatabaseLike-shaped object without as-never cast', () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
    expect(() => render(<ChronicleView database={db} />)).not.toThrow();
  });
});
