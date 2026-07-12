// M5-S04: Chronicle view — chronological event list.
// See: https://github.com/Djimon/WorldBrain/issues/70
//
// #270 (2026-07): type-filter, type-badge and precision-aware display
// removed — the event-entity-service model (event_kind/start_day/end_day)
// carries neither `type` nor `precision`. Rumor/Prophecy move to a future,
// separate Lore-Entity concept, not Event. Deprecated tests removed by
// direct user authorization (same test file, no new issue needed — user:
// "testet der test noch was anderes? falls er genau nur da stestes,
// einfach deprecated setzen").

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChronicleView } from '../src/ui/ChronicleView';

vi.mock('../src/services/event-entity-service', () => ({
  listEventEntities: vi.fn(async () => [
    { id: 'ev-1', title: 'Battle of Iron Keep', start_day: 100, event_kind: 'single' },
    { id: 'ev-2', title: 'The Rumor', start_day: 500, event_kind: 'single' },
    { id: 'ev-3', title: 'Council Meeting', start_day: 800, event_kind: 'single' },
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

  describe('event click', () => {
    it('clicking an event calls onEventSelect', async () => {
      const onSelect = vi.fn();
      render(<ChronicleView database={mockDb as never} onEventSelect={onSelect} />);
      await waitFor(() => expect(screen.getByText('Battle of Iron Keep')).toBeInTheDocument());
      fireEvent.click(screen.getByText('Battle of Iron Keep'));
      expect(onSelect).toHaveBeenCalledWith('ev-1');
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
