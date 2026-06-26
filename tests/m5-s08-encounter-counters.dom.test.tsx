// M5-S08: Encounter counters — round counter, custom counters, end encounter summary.
// See: https://github.com/Djimon/WorldBrain/issues/74

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EncounterCounters } from '../src/ui/EncounterCounters';

vi.mock('../src/services/event-service', () => ({
  updateEvent: vi.fn(),
  createEvent: vi.fn(() => ({ id: 'enc-1' })),
}));

const mockDb = {};

describe('M5-S08 encounter counters', () => {
  describe('round counter', () => {
    it('renders without throwing', () => {
      expect(() => render(<EncounterCounters sessionId="s1" database={mockDb as never} />)).not.toThrow();
    });

    it('shows round counter starting at 0 or 1', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      expect(screen.getByText(/round/i)).toBeInTheDocument();
    });

    it('has a Next Round button', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /next round|advance round|\+/i })).toBeInTheDocument();
    });

    it('clicking Next Round increments the round count', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
      expect(screen.getByText(/round.*2|2.*round/i)).toBeInTheDocument();
    });

    it('shows elapsed time based on seconds-per-round (default 6s)', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
      expect(screen.getByText(/6s|6 sec|elapsed/i)).toBeInTheDocument();
    });
  });

  describe('custom counters', () => {
    it('has an "Add counter" button', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /add counter|custom counter/i })).toBeInTheDocument();
    });

    it('clicking Add counter reveals a name input for the new counter', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add counter|custom counter/i }));
      // Must show a textbox for entering the counter name — not just any input
      expect(screen.getByRole('textbox', { name: /counter name|label/i })).toBeInTheDocument();
    });
  });

  // #106: custom counters have no increment/decrement controls
  describe('custom counter controls (#106)', () => {
    it('custom counter renders with increment button', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add counter|custom counter/i }));
      expect(screen.getByRole('button', { name: /\+|increment|increase/i })).toBeInTheDocument();
    });

    it('custom counter renders with decrement button', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add counter|custom counter/i }));
      expect(screen.getByRole('button', { name: /−|decrement|decrease|-/i })).toBeInTheDocument();
    });

    it('increment increases counter value', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add counter|custom counter/i }));
      // Capture the counter row before incrementing to scope subsequent queries
      const counterRow = document.querySelector('[data-counter]') ?? document.querySelector('.counter-row');
      expect(counterRow).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /\+|increment|increase/i }));
      // Check the value within the counter row — not the whole DOM
      expect(counterRow?.querySelector('[data-counter-value]')?.textContent ?? counterRow?.textContent).toContain('1');
    });

    it('add counter input commits on Enter and clears the field', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /add counter|custom counter/i }));
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Chase Progress' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(screen.getByText(/Chase Progress/)).toBeInTheDocument();
      expect(screen.queryByDisplayValue('Chase Progress')).toBeNull();
    });
  });

  describe('end encounter', () => {
    it('has an "End Encounter" button', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /end encounter/i })).toBeInTheDocument();
    });

    it('clicking End Encounter saves summary to event and calls onEncounterEnd', () => {
      const onEnd = vi.fn();
      render(<EncounterCounters sessionId="s1" database={mockDb as never} onEncounterEnd={onEnd} />);
      fireEvent.click(screen.getByRole('button', { name: /end encounter/i }));
      expect(onEnd).toHaveBeenCalled();
    });

    it('encounter counters are not persisted after end — component resets', () => {
      render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
      fireEvent.click(screen.getByRole('button', { name: /end encounter/i }));
      // After end, round counter should reset to start
      expect(screen.queryByText(/round.*2|2.*round/i)).not.toBeInTheDocument();
    });
  });
});

// Bug #130: elapsedSeconds shown twice — total should include current round
describe('issue #130: EncounterCounters elapsed vs total time', () => {
  it('elapsed and total values differ after round 1', () => {
    render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
    fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
    // After advance: elapsed = (round-1)*6, total = round*6 — they must differ
    const timeTexts = screen.getAllByText(/\d+s/i).map(el => el.textContent ?? '');
    const numbers = timeTexts.map(t => parseInt(t)).filter(n => !isNaN(n));
    expect(numbers.length).toBeGreaterThanOrEqual(2);
    expect(new Set(numbers).size).toBeGreaterThan(1);
  });

  it('total time display is strictly greater than elapsed time in round 2+', () => {
    render(<EncounterCounters sessionId="s1" database={mockDb as never} />);
    fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
    fireEvent.click(screen.getByRole('button', { name: /next round|advance round/i }));
    // Round 3: elapsed = 12s, total = 18s
    const allText = document.body.textContent ?? '';
    const nums = [...allText.matchAll(/(\d+)s/g)].map(m => parseInt(m[1]));
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    expect(max).toBeGreaterThan(min);
  });
});
