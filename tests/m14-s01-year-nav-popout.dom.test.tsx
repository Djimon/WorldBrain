// M14-S01: Jahr-Navigation als Popout
// See: https://github.com/Djimon/WorldBrain/issues/256
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts at
// call sites (except the one existing regression-test cast pattern already
// used for this component in m5-s05).
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): all name/text queries below are anchored or use
// getAllBy*/within where labels could collide (year digits vs. day digits).

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarMonthView } from '../src/ui/CalendarMonthView';

const earthCalendar = { id: 'cal-earth', title: 'Earth-like', year_length_days: 365, months: [{ name: 'January', days: 31 }, { name: 'February', days: 28 }], week: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], start_year: 400 };

vi.mock('../src/services/event-service', () => ({
  listEvents: vi.fn(async () => []),
}));

const mockDb = {};

async function openYearPopout() {
  render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
  const trigger = await screen.findByRole('button', { name: /^jahr$|^year$/i });
  fireEvent.click(trigger);
  return trigger;
}

describe('M14-S01 year navigation popout', () => {
  describe('trigger opens a popout (not permanently visible)', () => {
    it('the "Gehe zu Jahr" button is not visible before the trigger is clicked', () => {
      render(<CalendarMonthView calendar={earthCalendar} database={mockDb as never} />);
      expect(screen.queryByRole('button', { name: /^gehe zu jahr$/i })).not.toBeInTheDocument();
    });

    it('clicking the year trigger reveals the popout controls', async () => {
      await openYearPopout();
      expect(await screen.findByRole('button', { name: /^gehe zu jahr$/i })).toBeInTheDocument();
    });
  });

  describe('quick-jump -5 / +5', () => {
    it('"+5" advances the view year by 5', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      fireEvent.click(screen.getByRole('button', { name: /^\+5$/ }));
      await waitFor(() => expect(heading.textContent).toMatch(/\b405\b/));
    });

    it('"-5" moves the view year back by 5', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      fireEvent.click(screen.getByRole('button', { name: /^[-−]5$/ }));
      await waitFor(() => expect(heading.textContent).toMatch(/\b395\b/));
    });
  });

  describe('integer input + "Gehe zu Jahr" jumps to a signed year, including negative', () => {
    it('"Gehe zu Jahr" with -50 sets the view year to -50', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      const input = screen.getByRole('spinbutton', { name: /^jahr$/i });
      fireEvent.change(input, { target: { value: '-50' } });
      fireEvent.click(screen.getByRole('button', { name: /^gehe zu jahr$/i }));
      await waitFor(() => expect(heading.textContent).toMatch(/-50\b/));
    });

    it('the month is unchanged after a year jump', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      const input = screen.getByRole('spinbutton', { name: /^jahr$/i });
      fireEvent.change(input, { target: { value: '-50' } });
      fireEvent.click(screen.getByRole('button', { name: /^gehe zu jahr$/i }));
      await waitFor(() => expect(heading.textContent).toMatch(/^january\b/i));
    });

    it('an empty year input disables "Gehe zu Jahr"', async () => {
      await openYearPopout();
      const input = screen.getByRole('spinbutton', { name: /^jahr$/i });
      fireEvent.change(input, { target: { value: '' } });
      expect(screen.getByRole('button', { name: /^gehe zu jahr$/i })).toBeDisabled();
    });
  });

  describe('MRU recent-year pills', () => {
    it('after visiting 400 -> 395 -> 390, the popout shows pills for the last 3 distinct years, newest first', async () => {
      await openYearPopout();
      // Visit 395 via -5, then 390 via -5 again (starting year is 400).
      fireEvent.click(screen.getByRole('button', { name: /^[-−]5$/ }));
      fireEvent.click(screen.getByRole('button', { name: /^[-−]5$/ }));
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      const pills = within(popout).getAllByRole('button', { name: /^jahr \d+$/i });
      const pillYears = pills.map((p) => p.textContent?.match(/\d+/)?.[0]);
      expect(pillYears).toEqual(['390', '395', '400']);
    });

    it('re-visiting an already-recent year does not duplicate its pill', async () => {
      await openYearPopout();
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      fireEvent.click(screen.getByRole('button', { name: /^[-−]5$/ })); // 395
      fireEvent.click(screen.getByRole('button', { name: /^\+5$/ }));   // back to 400 (already recent)
      const pills = within(popout).getAllByRole('button', { name: /^jahr \d+$/i });
      const pillYears = pills.map((p) => p.textContent?.match(/\d+/)?.[0]);
      expect(new Set(pillYears).size).toBe(pillYears.length);
    });

    it('clicking a recent-year pill jumps the view to that year', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      fireEvent.click(screen.getByRole('button', { name: /^[-−]5$/ })); // visits 395, current year now 395
      fireEvent.click(screen.getByRole('button', { name: /^jahr 400$/i }), { target: popout });
      await waitFor(() => expect(heading.textContent).toMatch(/\b400\b/));
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('CalendarMonthView.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/CalendarMonthView.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
