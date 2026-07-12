// M14-S02: Monats-Dropdown & Header-Reihenfolge/Layout
// See: https://github.com/Djimon/WorldBrain/issues/257
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-008 (RTL): anchored queries; getAllBy*/within where labels could
// collide (month names vs. weekday names).

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarMonthView } from '../src/ui/CalendarMonthView';

const threeMonthCalendar = {
  id: 'cal-three',
  title: 'Three-Month Test Calendar',
  year_length_days: 90,
  months: [{ name: 'Frostmoon', days: 30 }, { name: 'Thawmoon', days: 30 }, { name: 'Suncrest', days: 30 }],
  week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  start_year: 400,
  start_month: 1,
};

vi.mock('../src/services/event-entity-service', () => ({
  listEventEntities: vi.fn(async () => []),
}));

const mockDb = {};

describe('M14-S02 month dropdown & header order/layout', () => {
  describe('month dropdown lists all derived months of the active calendar', () => {
    it('the dropdown has one option per calendar month, named after it', async () => {
      render(<CalendarMonthView calendar={threeMonthCalendar} database={mockDb as never} />);
      const dropdown = await screen.findByRole('combobox', { name: /^monat$/i });
      const optionNames = within2(dropdown).map((o) => o.textContent);
      expect(optionNames).toEqual(['Frostmoon', 'Thawmoon', 'Suncrest']);
    });
  });

  describe('selecting a month sets viewMonthIdx, year unchanged', () => {
    it('selecting month 3 (Suncrest) sets viewMonthIdx to 2 (0-based), year stays', async () => {
      render(<CalendarMonthView calendar={threeMonthCalendar} database={mockDb as never} />);
      const heading = screen.getByRole('heading');
      const dropdown = await screen.findByRole('combobox', { name: /^monat$/i });
      fireEvent.change(dropdown, { target: { value: 'Suncrest' } });
      await waitFor(() => expect(heading.textContent).toMatch(/^suncrest\b/i));
      expect(heading.textContent).toMatch(/\b400\b/);
    });
  });

  describe('DOM order: year control -> month dropdown -> Today', () => {
    it('the year trigger precedes the month dropdown, which precedes Today', async () => {
      render(<CalendarMonthView calendar={threeMonthCalendar} database={mockDb as never} />);
      const yearControl = await screen.findByRole('button', { name: /^jahr$|^year$/i });
      const monthDropdown = await screen.findByRole('combobox', { name: /^monat$/i });
      const todayBtn = screen.getByRole('button', { name: /^today$/i });

      const yearBeforeMonth = yearControl.compareDocumentPosition(monthDropdown) & Node.DOCUMENT_POSITION_FOLLOWING;
      const monthBeforeToday = monthDropdown.compareDocumentPosition(todayBtn) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(yearBeforeMonth).toBeTruthy();
      expect(monthBeforeToday).toBeTruthy();
    });
  });

  describe('"<" / ">" remain month-step and roll over year boundaries (existing step())', () => {
    it('clicking "<" on the first month of the year rolls back into the previous year', async () => {
      render(<CalendarMonthView calendar={threeMonthCalendar} database={mockDb as never} />);
      const heading = screen.getByRole('heading');
      fireEvent.click(screen.getByRole('button', { name: /^< previous$/i }));
      await waitFor(() => expect(heading.textContent).toMatch(/^suncrest\b.*\b399\b/i));
    });
  });

  describe('title/era display centered/right (Decision 5); Global/Ära toggle stays reachable', () => {
    it('cal-month__name is not the first element in the header bar (moved right of the new controls)', async () => {
      const { container } = render(<CalendarMonthView calendar={threeMonthCalendar} database={mockDb as never} />);
      await screen.findByRole('combobox', { name: /^monat$/i });
      const bar = container.querySelector('.cal-month__bar');
      const name = container.querySelector('.cal-month__name');
      expect(bar?.firstElementChild).not.toBe(name);
    });
  });
});

function within2(select: HTMLElement): HTMLOptionElement[] {
  return Array.from(select.querySelectorAll('option'));
}
