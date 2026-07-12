// M14-S06: Tag-Klick → Event-Erstellung mit vorbelegtem Datum
// See: https://github.com/Djimon/WorldBrain/issues/261
//
// Note: EventQuickCreatePanel is a new, focused component covering this
// story's panel behavior directly (title, prefilled date, create/cancel).
// WorkspaceShell.tsx (which owns wiring CalendarMonthView's onCreateEvent to
// this panel) has no existing render-test harness anywhere in this repo —
// it needs useDatabase() context plus a dozen list-services from a live
// project. Building that harness here would be scope creep for a single
// wiring check, so that specific AC bullet ("WorkspaceShell reicht
// onCreateEvent durch") is covered by a static source check instead of a
// full WorkspaceShell render (AGENTS.md: no over-engineering the current
// slice).
//
// AP-001: n/a — this panel takes no database prop (title-only create,
// caller owns the actual createEventEntity call via onCreate).
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored name queries.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventQuickCreatePanel } from '../src/ui/EventQuickCreatePanel';

describe('M14-S06 event quick-create panel (day-click)', () => {
  describe('opens with a prefilled date and an empty, focused title field', () => {
    it('shows the prefilled day', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      expect(screen.getByText(/\b42\b/)).toBeInTheDocument();
    });

    it('has an empty title textbox', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      const titleInput = screen.getByRole('textbox', { name: /^titel$/i });
      expect(titleInput).toHaveValue('');
    });
  });

  describe('empty/whitespace title disables "Erstellen"', () => {
    it('the create button is disabled when the title is empty', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      expect(screen.getByRole('button', { name: /^erstellen$/i })).toBeDisabled();
    });

    it('the create button is disabled when the title is only whitespace', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      const titleInput = screen.getByRole('textbox', { name: /^titel$/i });
      fireEvent.change(titleInput, { target: { value: '   ' } });
      expect(screen.getByRole('button', { name: /^erstellen$/i })).toBeDisabled();
    });

    it('the create button is enabled once a non-blank title is entered', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      const titleInput = screen.getByRole('textbox', { name: /^titel$/i });
      fireEvent.change(titleInput, { target: { value: 'Sturm zieht auf' } });
      expect(screen.getByRole('button', { name: /^erstellen$/i })).not.toBeDisabled();
    });
  });

  describe('"Erstellen" calls onCreate with title, start_day=D, event_kind=single', () => {
    it('clicking create calls onCreate with the prefilled day and default event_kind', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      const titleInput = screen.getByRole('textbox', { name: /^titel$/i });
      fireEvent.change(titleInput, { target: { value: 'Sturm zieht auf' } });
      fireEvent.click(screen.getByRole('button', { name: /^erstellen$/i }));
      expect(onCreate).toHaveBeenCalledWith({ title: 'Sturm zieht auf', start_day: 42, event_kind: 'single' });
    });
  });

  describe('cancel / Escape closes without creating', () => {
    it('clicking "Abbrechen" calls onCancel, not onCreate', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      fireEvent.click(screen.getByRole('button', { name: /^abbrechen$/i }));
      expect(onCancel).toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
    });

    it('pressing Escape in the title field calls onCancel, not onCreate', () => {
      const onCreate = vi.fn();
      const onCancel = vi.fn();
      render(<EventQuickCreatePanel day={42} onCreate={onCreate} onCancel={onCancel} />);
      const titleInput = screen.getByRole('textbox', { name: /^titel$/i });
      fireEvent.keyDown(titleInput, { key: 'Escape' });
      expect(onCancel).toHaveBeenCalled();
      expect(onCreate).not.toHaveBeenCalled();
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('EventQuickCreatePanel.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/EventQuickCreatePanel.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});

describe('WorkspaceShell wires onCreateEvent through to CalendarMonthView (static check)', () => {
  it('WorkspaceShell.tsx passes an onCreateEvent prop to <CalendarMonthView>', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    const calendarViewUsage = src.match(/<CalendarMonthView[\s\S]*?\/>/)?.[0] ?? '';
    expect(calendarViewUsage).toMatch(/onCreateEvent=/);
  });
});
