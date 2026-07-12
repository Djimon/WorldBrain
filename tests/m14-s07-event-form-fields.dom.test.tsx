// M14-S07: Event-Formular — kind, participants/locations, visibility
// See: https://github.com/Djimon/WorldBrain/issues/262
//
// Note: title/body are the standard entity edit form (EntityDetailView),
// not rebuilt here per this Story's AC — this file covers only the
// event-specific extra fields. See EventFormFields.tsx's header comment for
// the end_day-widget scoping note (plain counter-day input, not the full
// CalendarDateInput + calendar-conversion pipeline).
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored queries; getAllBy*/within where participant vs.
// location pill labels could collide.

import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EventFormFields, isEventFormValid } from '../src/ui/EventFormFields';

vi.mock('../src/services/entity-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/entity-service')>();
  return {
    ...actual,
    listEntitiesByType: vi.fn(async () => [
      { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: '' },
      { id: 'loc-keep', type: 'Location', title: 'Iron Keep', summary: '' },
    ]),
  };
});

vi.mock('../src/services/relation-service', () => ({
  addRelation: vi.fn(async () => ({ id: 'rel-1' })),
  deactivateRelation: vi.fn(),
  getRelations: vi.fn(async () => []),
}));

const mockDb = { execute: vi.fn(), select: vi.fn() };

function baseProps(overrides: Partial<ComponentProps<typeof EventFormFields>> = {}) {
  return {
    database: mockDb,
    eventId: 'event-1',
    kind: 'single' as const,
    startDay: 42,
    endDay: undefined,
    onKindChange: vi.fn(),
    onEndDayChange: vi.fn(),
    visibility: 'public',
    onVisibilityChange: vi.fn(),
    ...overrides,
  };
}

describe('M14-S07 event form fields (kind, participants/locations, visibility)', () => {
  describe('isEventFormValid: phase requires end_day >= start_day', () => {
    it('single kind is always valid regardless of end_day', () => {
      expect(isEventFormValid('single', 10, undefined)).toBe(true);
    });

    it('phase with end_day >= start_day is valid', () => {
      expect(isEventFormValid('phase', 10, 15)).toBe(true);
    });

    it('phase with end_day < start_day is invalid', () => {
      expect(isEventFormValid('phase', 10, 5)).toBe(false);
    });

    it('phase without an end_day is invalid', () => {
      expect(isEventFormValid('phase', 10, undefined)).toBe(false);
    });
  });

  describe('event_kind switcher: phase reveals end_day, single hides it', () => {
    it('kind=single does not show an end_day field', () => {
      render(<EventFormFields {...baseProps({ kind: 'single' })} />);
      expect(screen.queryByRole('spinbutton', { name: /^enddatum$/i })).not.toBeInTheDocument();
    });

    it('kind=phase shows an end_day field', () => {
      render(<EventFormFields {...baseProps({ kind: 'phase', endDay: 50 })} />);
      expect(screen.getByRole('spinbutton', { name: /^enddatum$/i })).toBeInTheDocument();
    });

    it('clicking the "Phase" switch calls onKindChange("phase")', () => {
      const onKindChange = vi.fn();
      render(<EventFormFields {...baseProps({ onKindChange })} />);
      fireEvent.click(screen.getByRole('button', { name: /^phase$/i }));
      expect(onKindChange).toHaveBeenCalledWith('phase');
    });
  });

  describe('participants: autofill Pill field creates event_has_participant relation', () => {
    it('confirming a typed participant name creates the relation and shows a pill', async () => {
      const { addRelation } = await import('../src/services/relation-service');
      render(<EventFormFields {...baseProps()} />);
      const input = screen.getByRole('textbox', { name: /^teilnehmer$/i });
      fireEvent.change(input, { target: { value: 'Ada Thorn' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() =>
        expect(addRelation).toHaveBeenCalledWith(mockDb, expect.objectContaining({
          source_id: 'event-1', target_id: 'char-ada',
          relation_type: 'event_has_participant', inverse_type: 'participant_in',
        })),
      );
    });

    it('removing a participant pill deactivates its relation', async () => {
      const { getRelations, deactivateRelation } = await import('../src/services/relation-service');
      (getRelations as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { id: 'rel-p1', source_id: 'event-1', target_id: 'char-ada', relation_type: 'event_has_participant', inverse_type: 'participant_in', active: 1, visibility_json: '"public"', notes: null },
      ]);
      render(<EventFormFields {...baseProps()} />);
      const pill = await screen.findByText(/ada thorn/i);
      const pillContainer = pill.closest('[data-pill]') as HTMLElement;
      fireEvent.click(within(pillContainer).getByRole('button', { name: /^entfernen$/i }));
      await waitFor(() => expect(deactivateRelation).toHaveBeenCalledWith(mockDb, 'rel-p1'));
    });
  });

  describe('locations: autofill Pill field creates event_at_location relation', () => {
    it('confirming a typed location name creates the relation', async () => {
      const { addRelation } = await import('../src/services/relation-service');
      render(<EventFormFields {...baseProps()} />);
      const input = screen.getByRole('textbox', { name: /^orte$/i });
      fireEvent.change(input, { target: { value: 'Iron Keep' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      await waitFor(() =>
        expect(addRelation).toHaveBeenCalledWith(mockDb, expect.objectContaining({
          source_id: 'event-1', target_id: 'loc-keep',
          relation_type: 'event_at_location', inverse_type: 'location_of',
        })),
      );
    });
  });

  describe('visibility selection writes entity visibility', () => {
    it('changing the visibility select calls onVisibilityChange', () => {
      const onVisibilityChange = vi.fn();
      render(<EventFormFields {...baseProps({ onVisibilityChange })} />);
      fireEvent.change(screen.getByRole('combobox', { name: /^sichtbarkeit$/i }), { target: { value: 'gm_only' } });
      expect(onVisibilityChange).toHaveBeenCalledWith('gm_only');
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('EventFormFields.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/EventFormFields.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
