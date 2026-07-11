// M14-S01: Jahr-Navigation als Popout
// See: https://github.com/Djimon/WorldBrain/issues/256
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts at
// call sites (except the one existing regression-test cast pattern already
// used for this component in m5-s05).
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): all name/text queries below are anchored or use
// getAllBy*/within where labels could collide (MRU pills "Jahr N" vs.
// adjacency pills "Springe zu Jahr N" vs. day digits).

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

function jumpToAdjacentYear(year: number) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^springe zu jahr ${year}$`, 'i') }));
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

  describe('10 adjacency pills next to the active year (5 predecessor, 5 successor)', () => {
    it('renders 5 predecessor and 5 successor year pills around year 400', async () => {
      await openYearPopout();
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      for (const y of [395, 396, 397, 398, 399, 401, 402, 403, 404, 405]) {
        expect(within(popout).getByRole('button', { name: new RegExp(`^springe zu jahr ${y}$`, 'i') })).toBeInTheDocument();
      }
    });

    it('clicking a predecessor pill jumps the view to that year', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      jumpToAdjacentYear(395);
      await waitFor(() => expect(heading.textContent).toMatch(/\b395\b/));
    });

    it('clicking a successor pill jumps the view to that year', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      jumpToAdjacentYear(405);
      await waitFor(() => expect(heading.textContent).toMatch(/\b405\b/));
    });

    it('the adjacency window recomputes around the new active year after a jump', async () => {
      await openYearPopout();
      jumpToAdjacentYear(395);
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      await waitFor(() =>
        expect(within(popout).getByRole('button', { name: /^springe zu jahr 390$/i })).toBeInTheDocument(),
      );
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
      // Visit 395 via its adjacency pill, then 390 via the recomputed window.
      jumpToAdjacentYear(395);
      await screen.findByRole('button', { name: /^springe zu jahr 390$/i });
      jumpToAdjacentYear(390);
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      const pills = within(popout).getAllByRole('button', { name: /^jahr \d+$/i });
      const pillYears = pills.map((p) => p.textContent?.match(/\d+/)?.[0]);
      expect(pillYears).toEqual(['390', '395', '400']);
    });

    it('re-visiting an already-recent year does not duplicate its pill', async () => {
      await openYearPopout();
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      jumpToAdjacentYear(395);
      await screen.findByRole('button', { name: /^springe zu jahr 400$/i }); // window recomputed, 400 is now a successor pill
      jumpToAdjacentYear(400); // back to 400 (already recent)
      const pills = within(popout).getAllByRole('button', { name: /^jahr \d+$/i });
      const pillYears = pills.map((p) => p.textContent?.match(/\d+/)?.[0]);
      expect(new Set(pillYears).size).toBe(pillYears.length);
    });

    it('clicking a recent-year pill jumps the view to that year', async () => {
      await openYearPopout();
      const heading = screen.getByRole('heading');
      const popout = await screen.findByRole('dialog', { name: /^jahr-navigation$/i });
      jumpToAdjacentYear(395); // visits 395, current year now 395
      fireEvent.click(within(popout).getByRole('button', { name: /^jahr 400$/i }));
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
