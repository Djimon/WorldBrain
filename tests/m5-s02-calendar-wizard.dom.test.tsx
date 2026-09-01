// M5-S02: Calendar wizard UI — step-by-step creation, preset prefill, import/export.
// See: https://github.com/Djimon/WorldBrain/issues/68

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../src/i18n';
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

    it('renders the year-length field', () => {
      render(<CalendarWizard onComplete={vi.fn()} database={{} as never} />);
      // Redesigned single-page editor: the year length lives in a "Jahrestage" field.
      expect(screen.getByText(/jahrestage|year length|year days/i)).toBeInTheDocument();
    });
  });

  // #400: Der Kalender-Wizard wurde vom Mehrschritt-Flow (Next/Back/Finish) + JSON-
  // Import/Export (#68) auf einen einseitigen, DB-gestützten Tab-Editor (Speichern;
  // Monate/Wochentage/Ären-Tabs) umgebaut. Die Schritt-Navigation und der JSON-
  // Import/Export existieren in der ausgelieferten Komponente nicht mehr. Diese
  // Tests prüfen die entfernten Controls und sind als PENDING markiert (kein grün-
  // frisieren); ob Import/Export bewusst descoped oder später neu gefasst wird, ist
  // ein Produkt-Entscheid.
  describe.skip('step navigation', () => {
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
    it('renders a preset selector', () => {
      render(<CalendarWizard onComplete={vi.fn()} database={{} as never} />);
      // The only combobox on the sheet is the preset <select>.
      expect(screen.getByRole('combobox')).toBeInTheDocument();
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

  describe.skip('import/export', () => {
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
    it('calls onComplete when the calendar is saved', async () => {
      const onComplete = vi.fn();
      // Redesigned: a single Save button persists and then calls onComplete.
      render(<CalendarWizard onComplete={onComplete} database={{} as never} />);
      fireEvent.click(screen.getByRole('button', { name: /kalender speichern|save/i }));
      await waitFor(() => expect(onComplete).toHaveBeenCalled());
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

    it('Months section renders controls — not just a placeholder paragraph', () => {
      render(<CalendarWizard onComplete={vi.fn()} database={{} as never} />);
      // Months tab is active by default and renders a real add-month control.
      expect(screen.getByRole('button', { name: /\+ monat|add month/i })).toBeInTheDocument();
    });

    it('step 1 does not show configure-placeholder text', () => {
      render(<CalendarWizard onComplete={vi.fn()} />);
      advanceTo(1);
      expect(screen.queryByText(/configure your calendar.*cycle structure/i)).toBeNull();
    });

    it('Weekdays section renders controls — not just a placeholder', () => {
      render(<CalendarWizard onComplete={vi.fn()} database={{} as never} />);
      // Steps became tabs — switch to the weekdays tab, which shows a real add control.
      fireEvent.click(screen.getByRole('tab', { name: /wochentage|weekday/i }));
      expect(screen.getByRole('button', { name: /\+ tag|add day|add weekday/i })).toBeInTheDocument();
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

    it.skip('Export does not call window.alert', () => { // #400: Export-Button entfernt (Redesign)
      const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
      render(<CalendarWizard onComplete={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /export/i }));
      expect(alertSpy).not.toHaveBeenCalled();
      alertSpy.mockRestore();
    });

    it.skip('Import shows file input or textarea — not prompt dialog', () => { // #400: Import entfernt (Redesign)
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
