// M14-S03: Geklemmtes Datums-Widget CalendarDateInput
// See: https://github.com/Djimon/WorldBrain/issues/258
//
// AP-001: n/a — this widget takes no database prop.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored name queries (Tag/Monat/Jahr share no prefix, but
// anchored regardless per the story's blanket AC requirement).

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarDateInput } from '../src/ui/CalendarDateInput';

const twoMonths = [{ name: 'Frostmoon', days: 31 }, { name: 'Thawmoon', days: 30 }];

describe('M14-S03 CalendarDateInput (clamped y/m/d widget)', () => {
  describe('renders day/month/year inputs from props', () => {
    it('renders without throwing and shows Tag/Monat/Jahr inputs', () => {
      const onChange = vi.fn();
      expect(() =>
        render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 15 }} onChange={onChange} />),
      ).not.toThrow();
      expect(screen.getByRole('spinbutton', { name: /^tag$/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /^monat$/i })).toBeInTheDocument();
      expect(screen.getByRole('spinbutton', { name: /^jahr$/i })).toBeInTheDocument();
    });
  });

  describe('day auto-snap when a month change shortens the day maximum', () => {
    it('day 31 in a 31-day month, switching to a 30-day month snaps day to 30', () => {
      const onChange = vi.fn();
      render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 31 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^monat$/i }), { target: { value: '2' } });
      expect(onChange).toHaveBeenCalledWith({ year: 400, month: 2, day: 30 });
    });

    it('the snap applies a one-tick visual cue class', () => {
      const onChange = vi.fn();
      render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 31 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^monat$/i }), { target: { value: '2' } });
      const dayInput = screen.getByRole('spinbutton', { name: /^tag$/i });
      expect(dayInput.className).toMatch(/cal-dateinput--snap/);
    });
  });

  describe('month clamped to [1, months.length]', () => {
    it('entering month 14 with 2 defined months clamps to 2', () => {
      const onChange = vi.fn();
      render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 15 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^monat$/i }), { target: { value: '14' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ month: 2 }));
    });
  });

  describe('day clamped to [1, months[month-1].days]', () => {
    it('entering day 0 clamps to 1', () => {
      const onChange = vi.fn();
      render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 15 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^tag$/i }), { target: { value: '0' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ day: 1 }));
    });
  });

  describe('year is signed and unbounded (the only negative-capable field)', () => {
    it('entering year -7 is accepted as-is (no clamping)', () => {
      const onChange = vi.fn();
      render(<CalendarDateInput months={twoMonths} value={{ year: 400, month: 1, day: 15 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^jahr$/i }), { target: { value: '-7' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ year: -7 }));
    });
  });

  describe('no hard 12-month assumption', () => {
    it('a 5-month calendar clamps month input to 5, not 12', () => {
      const onChange = vi.fn();
      const fiveMonths = Array.from({ length: 5 }, (_, i) => ({ name: `M${i + 1}`, days: 20 }));
      render(<CalendarDateInput months={fiveMonths} value={{ year: 400, month: 1, day: 10 }} onChange={onChange} />);
      fireEvent.change(screen.getByRole('spinbutton', { name: /^monat$/i }), { target: { value: '9' } });
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ month: 5 }));
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('CalendarDateInput.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/CalendarDateInput.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
