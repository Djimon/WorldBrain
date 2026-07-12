// M14-S05: Kalender rendert Event-Entities
// See: https://github.com/Djimon/WorldBrain/issues/260
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts
// (except the one existing regression-test cast pattern already used for
// this component, see issue #124 test below).
// AP-008 (RTL): anchored/scoped queries; getAllBy*/within where day-number
// text could collide across cells.

import { readFileSync } from 'node:fs';
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarMonthView } from '../src/ui/CalendarMonthView';

const earthCalendar = { id: 'cal-earth', title: 'Earth-like', year_length_days: 365, months: [{ name: 'January', days: 31 }, { name: 'February', days: 28 }], week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] };

vi.mock('../src/services/event-entity-service', () => ({
  listEventEntities: vi.fn(async () => [
    { id: 'ev-1', title: 'Festival', start_day: 15, event_kind: 'single' },
    { id: 'ev-2', title: 'Long March', start_day: 20, end_day: 25, event_kind: 'phase' },
  ]),
}));

const mockDb = {};

describe('M14-S05 calendar renders Event entities', () => {
  describe('single event with start_day=D appears in the cell with data-day=D', () => {
    it('"Festival" (start_day=15) renders inside the day-15 cell', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(document.querySelector('[data-day="15"]')).toBeInTheDocument());
      const cell = document.querySelector('[data-day="15"]') as HTMLElement;
      expect(within(cell).getByText('Festival')).toBeInTheDocument();
    });
  });

  describe('phase event (start_day=A, end_day=B) spans every day A..B', () => {
    it('"Long March" (20..25) appears in day 20, 22, and 25 cells', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(document.querySelector('[data-day="20"]')).toBeInTheDocument());
      for (const day of [20, 22, 25]) {
        const cell = document.querySelector(`[data-day="${day}"]`) as HTMLElement;
        expect(within(cell).getByText('Long March')).toBeInTheDocument();
      }
    });

    it('"Long March" does not appear outside its range (day 19 or day 26)', async () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      await waitFor(() => expect(document.querySelector('[data-day="20"]')).toBeInTheDocument());
      for (const day of [19, 26]) {
        const cell = document.querySelector(`[data-day="${day}"]`) as HTMLElement;
        expect(within(cell).queryByText('Long March')).not.toBeInTheDocument();
      }
    });
  });

  describe('no reference to the removed events table / event-service in the UI', () => {
    it('CalendarMonthView.tsx does not import event-service', () => {
      const src = readFileSync('src/ui/CalendarMonthView.tsx', 'utf-8');
      expect(src).not.toMatch(/from ['"]\.\.\/services\/event-service['"]/);
    });

    it('CalendarMonthView.tsx does not reference the "events" table', () => {
      const src = readFileSync('src/ui/CalendarMonthView.tsx', 'utf-8');
      expect(src).not.toMatch(/\bFROM\s+events\b/i);
    });
  });

  describe('rendering unaffected otherwise', () => {
    it('renders without throwing', () => {
      expect(() => render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />)).not.toThrow();
    });
  });
});
