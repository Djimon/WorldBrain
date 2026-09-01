// M5-S02: Calendar editor UI — einseitige Tab-Maske (Monate/Wochentage/Ären),
// Preset-Vorbelegung, Speichern. #400: der ursprüngliche Mehrschritt-„Wizard" +
// JSON-Import/Export (#68) war eine ungewollte AI-Erfindung und wurde durch diese
// einfache Editor-Maske ersetzt — die zugehörigen Tests sind entfernt.
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
  });
});
