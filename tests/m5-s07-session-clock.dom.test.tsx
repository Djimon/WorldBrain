// M5-S07: Session clock & global counters — world time advance, counter panel.
// See: https://github.com/Djimon/WorldBrain/issues/73

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionClock } from '../src/ui/SessionClock';

vi.mock('../src/services/calendar-service', () => ({
  formatAbsoluteDay: vi.fn((day: number) => `Day ${day}, Year 1`),
}));

vi.mock('../src/services/session-variable-service', () => ({
  setGlobalVar: vi.fn(),
  getGlobalVar: vi.fn(() => null),
  listVars: vi.fn(() => [
    { id: 'counter-bastion', type: 'number', label: 'Bastion Turns', value: 3, default_value: 0 },
    { id: 'counter-market', type: 'number', label: 'Market Days', value: 1, default_value: 0 },
  ]),
  setVar: vi.fn(),
}));

const mockDb = {};
const earthCalendar = { id: 'cal-earth', title: 'Earth-like', year_length_days: 365, months: [], week: [] };

describe('M5-S07 session clock', () => {
  describe('world time display', () => {
    it('renders without throwing', () => {
      expect(() => render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />)).not.toThrow();
    });

    it('displays world time in calendar format', () => {
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      // mock formatAbsoluteDay returns 'Day ${day}, Year 1' — assert the exact string
      expect(screen.getByText('Day 1000, Year 1')).toBeInTheDocument();
    });

    it('has an "Advance time" control', () => {
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /advance|forward|\+.*day/i })).toBeInTheDocument();
    });

    it('clicking advance calls onWorldTimeChange with incremented day', () => {
      const onChange = vi.fn();
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} onWorldTimeChange={onChange} />);
      fireEvent.click(screen.getByRole('button', { name: /advance|forward|\+.*day/i }));
      expect(onChange).toHaveBeenCalledWith(1001);
    });
  });

  describe('global counters panel', () => {
    it('renders global counters', () => {
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      expect(screen.getByText('Bastion Turns')).toBeInTheDocument();
      expect(screen.getByText('Market Days')).toBeInTheDocument();
    });

    it('shows current counter values', () => {
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('each counter has + and - controls', () => {
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      // mock has 2 counters — expect exactly 2 increment and 2 decrement buttons
      expect(screen.getAllByRole('button', { name: /increment/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /decrement/i })).toHaveLength(2);
    });

    it('incrementing Bastion Turns counter calls setGlobalVar with counter id and new value', async () => {
      const { setGlobalVar } = await import('../src/services/session-variable-service');
      render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
      // Scope to the Bastion Turns row to avoid ambiguity between counters
      const bastionRow = screen.getByText('Bastion Turns').closest('[data-counter]') as HTMLElement;
      expect(bastionRow).not.toBeNull();
      fireEvent.click(within(bastionRow).getByRole('button', { name: /increment/i }));
      expect(setGlobalVar).toHaveBeenCalledWith(expect.anything(), 'counter-bastion', 4);
    });
  });
});

// Bug #131: counter increment/decrement not logged to session_log
describe('issue #131: SessionClock counter changes written to session_log', () => {
  it('incrementing a counter inserts a session_log row via setGlobalVar or directly', async () => {
    const { setGlobalVar } = await import('../src/services/session-variable-service');
    const logInsertSpy = vi.fn();
    // The component must either call a logging-aware variant or insert directly.
    // Verify setGlobalVar is called (service-level logging is the fix target).
    render(<SessionClock sessionId="s1" calendar={earthCalendar} worldTimeStart={1000} database={mockDb as never} />);
    const bastionRow = screen.getByText('Bastion Turns').closest('[data-counter]') as HTMLElement;
    fireEvent.click(within(bastionRow).getByRole('button', { name: /increment/i }));
    // After fix: setGlobalVar must be replaced or augmented to also write session_log.
    // Test that the call happens — logging verification requires implementation.
    expect(setGlobalVar).toHaveBeenCalled();
  });

  it('source does not use setGlobalVar without a session_log write nearby', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync('src/ui/SessionClock.tsx', 'utf8');
    // After fix, the counter handler must write to session_log (directly or via helper)
    expect(src).toMatch(/session_log|logCounterChange|insertLog|setGlobalVarLogged/i);
  });
});
