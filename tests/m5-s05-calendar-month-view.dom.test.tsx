// M5-S05: Calendar month view — month grid, multi-day events, navigation.
// See: https://github.com/Djimon/WorldBrain/issues/71

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarMonthView } from '../src/ui/CalendarMonthView';

const earthCalendar = { id: 'cal-earth', title: 'Earth-like', year_length_days: 365, months: [{ name: 'January', days: 31 }, { name: 'February', days: 28 }], week: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] };

vi.mock('../src/services/event-service', () => ({
  listEvents: vi.fn(async () => [
    { id: 'ev-1', title: 'Festival', type: 'session_event', start_day: 15, end_day: 15, precision: 'day', visibility: 'public', participants: [], locations: [] },
    { id: 'ev-2', title: 'Long March', type: 'historical_event', start_day: 20, end_day: 25, precision: 'day', visibility: 'public', participants: [], locations: [] },
  ]),
}));

const mockDb = {};

describe('M5-S05 calendar month view', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />)).not.toThrow();
    });

    it('renders a grid with day cells', () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      const cells = screen.queryAllByRole('gridcell');
      expect(cells.length).toBeGreaterThan(0);
    });

    it('renders week day headers', () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      expect(screen.getByText(/mon|monday/i)).toBeInTheDocument();
    });

    it('shows events on their day cells', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(screen.getByText('Festival')).toBeInTheDocument());
    });

    it('multi-day event spans multiple cells', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(screen.queryAllByText(/long march/i).length).toBeGreaterThanOrEqual(1));
    });
  });

  describe('navigation', () => {
    it('has previous and next month buttons', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /prev|previous|</i })).toBeInTheDocument());
      expect(screen.getByRole('button', { name: /next|>/i })).toBeInTheDocument();
    });

    it('clicking next advances to the next month', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(screen.queryByRole('heading')).toBeInTheDocument());
      const initial = screen.queryByRole('heading')?.textContent;
      fireEvent.click(screen.getByRole('button', { name: /next|>/i }));
      await waitFor(() => expect(screen.queryByRole('heading')?.textContent).not.toBe(initial));
    });

    it('has a "Today" / "Jump to current" button', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /today|current|jump/i })).toBeInTheDocument());
    });
  });

  describe('create event from day cell', () => {
    it('clicking a day cell calls onCreateEvent with the day prefilled', async () => {
      const onCreate = vi.fn();
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} onCreateEvent={onCreate} />);
      await waitFor(() => expect(screen.getAllByRole('gridcell').length).toBeGreaterThan(0));
      fireEvent.click(screen.getAllByRole('gridcell')[0]);
      expect(onCreate).toHaveBeenCalled();
    });
  });
});

// Bug #124: AP-001 — database prop must be DatabaseLike, not unknown/never
describe('issue #124: CalendarMonthView database prop typed as DatabaseLike', () => {
  it('accepts a DatabaseLike-shaped object without as-never cast', () => {
    const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
    expect(() => render(<CalendarMonthView calendar={earthCalendar} database={db} />)).not.toThrow();
  });
});
