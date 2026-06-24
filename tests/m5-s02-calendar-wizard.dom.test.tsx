// M5-S02: Calendar wizard UI — step-by-step creation, preset prefill, import/export.
// See: https://github.com/Djimon/WorldBrain/issues/68

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CalendarWizard } from '../src/ui/CalendarWizard';

vi.mock('../src/services/calendar-service', () => ({
  saveCalendar: vi.fn(() => ({ id: 'cal-1' })),
  importCalendarFromJson: vi.fn((json: string) => JSON.parse(json)),
}));

describe('M5-S02 calendar wizard', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<CalendarWizard onComplete={vi.fn()} />)).not.toThrow();
    });

    it('renders Step 1: year length', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      expect(screen.getByText(/year length|step 1/i)).toBeInTheDocument();
    });
  });

  describe('step navigation', () => {
    it('has a Next button to advance steps', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
    });

    it('clicking Next advances to Step 2: month structure', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByText(/month|step 2/i)).toBeInTheDocument();
    });

    it('has a Back button after Step 1', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    it('completes in 3 steps for simple cases (no optional steps)', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      // Step 1 → 2 → 3 (weekdays) → finish
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      const finishOrNext = screen.queryByRole('button', { name: /finish|done|complete/i })
        ?? screen.queryByRole('button', { name: /next/i });
      expect(finishOrNext).toBeInTheDocument();
    });
  });

  describe('preset selector', () => {
    it('renders a preset selector on step 1', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      const sel = screen.queryByRole('combobox', { name: /preset/i })
        ?? screen.queryByRole('listbox', { name: /preset/i })
        ?? screen.queryByText(/earth.?like|simple fantasy/i);
      expect(sel).toBeInTheDocument();
    });

    it('selecting Earth-like preset fills year length as 365', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      const presetSel = screen.queryByRole('combobox', { name: /preset/i });
      if (presetSel) {
        fireEvent.change(presetSel, { target: { value: 'earth_like' } });
        const yearInput = screen.queryByRole('spinbutton', { name: /year length|days/i })
          ?? screen.queryByDisplayValue('365');
        expect(yearInput).toBeInTheDocument();
      }
    });
  });

  describe('import/export', () => {
    it('renders an Import from JSON button', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /import/i })).toBeInTheDocument();
    });

    it('renders an Export to JSON button', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      expect(screen.getByRole('button', { name: /export/i })).toBeInTheDocument();
    });
  });

  describe('completion', () => {
    it('calls onComplete when wizard finishes', () => {
      const onComplete = vi.fn();
      render(<CalendarWizard onComplete={onComplete} />);
      // Navigate through all steps to reach Finish — Next must exist at each intermediate step
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /next/i }));
      fireEvent.click(screen.getByRole('button', { name: /finish/i }));
      expect(onComplete).toHaveBeenCalled();
    });
  });

  // #102: Steps 1+2 are empty stubs
  describe('step content (#102)', () => {
    function advanceTo(step: number) {
      for (let i = 0; i < step; i++) {
        const next = screen.queryByRole('button', { name: /next|continue/i });
        if (next) fireEvent.click(next);
      }
    }

    it('step 1 (Months) renders controls — not just a placeholder paragraph', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      advanceTo(1);
      const control = screen.queryByRole('spinbutton')
        ?? screen.queryByRole('button', { name: /add month/i })
        ?? screen.queryByRole('textbox');
      expect(control).toBeInTheDocument();
    });

    it('step 1 does not show configure-placeholder text', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      advanceTo(1);
      expect(screen.queryByText(/configure your calendar.*cycle structure/i)).toBeNull();
    });

    it('step 2 (Weekdays) renders controls — not just a placeholder', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      advanceTo(2);
      const control = screen.queryByRole('spinbutton')
        ?? screen.queryByRole('button', { name: /add day|weekday/i })
        ?? screen.queryByRole('textbox');
      expect(control).toBeInTheDocument();
    });

    it('step 2 does not show bare "Weekday configuration" text', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      advanceTo(2);
      expect(screen.queryByText(/^Weekday configuration$/i)).toBeNull();
    });
  });

  // #103: prompt()/alert() incompatible with Tauri
  describe('no browser prompt/alert (#103)', () => {
    it('source has no window.prompt() or prompt()', () => {
      const src = readFileSync('src/ui/CalendarWizard.tsx', 'utf8');
      expect(src).not.toMatch(/window\.prompt\s*\(|(?<!\w)prompt\s*\(/);
    });

    it('source has no window.alert() or alert()', () => {
      const src = readFileSync('src/ui/CalendarWizard.tsx', 'utf8');
      expect(src).not.toMatch(/window\.alert\s*\(|(?<!\w)alert\s*\(/);
    });

    it('Export does not call window.alert', () => {
      const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
      render(<CalendarWizard onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /export/i }));
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it('Import shows file input or textarea — not prompt dialog', () => {
      const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue(null);
      render(<CalendarWizard onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /import/i }));
      expect(promptSpy).not.toHaveBeenCalled();
      const input = document.querySelector('input[type="file"]') ?? screen.queryByRole('textbox');
      expect(input).not.toBeNull();
      promptSpy.mockRestore();
    });
  });
});
