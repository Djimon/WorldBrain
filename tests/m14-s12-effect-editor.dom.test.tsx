// M14-S12: Effekt-Editor im Event-Formular
// See: https://github.com/Djimon/WorldBrain/issues/267
//
// Note: day is a plain counter-day number input here, not the full
// CalendarDateInput widget — see EffectEditor.tsx's header comment (same
// scoping reasoning as EventFormFields.tsx / m14-s07).
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-008 (RTL): anchored queries.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EffectEditor } from '../src/ui/EffectEditor';

vi.mock('../src/services/event-effects-service', () => ({
  listEffects: vi.fn(async () => []),
  addEffect: vi.fn(async () => undefined),
  removeEffect: vi.fn(async () => undefined),
  updateEffect: vi.fn(async () => undefined),
}));

vi.mock('../src/services/world-state-projection', () => ({
  listWorldVariables: vi.fn(async () => ['world:siege']),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

const mockDb = { execute: vi.fn(), select: vi.fn() };

function renderEditor(startDay = 42) {
  return render(<EffectEditor database={mockDb} eventId="event-1" startDay={startDay} />);
}

describe('M14-S12 effect editor (event form)', () => {
  describe('day field defaults to the event start_day', () => {
    it('the day input is prefilled with start_day', async () => {
      renderEditor(42);
      const dayInput = await screen.findByRole('spinbutton', { name: /^tag$/i });
      expect(dayInput).toHaveValue(42);
    });
  });

  describe('adding a valid effect writes properties.effects (via addEffect)', () => {
    it('filling target/verb/value and clicking "Effekt hinzufügen" calls addEffect', async () => {
      const { addEffect } = await import('../src/services/event-effects-service');
      renderEditor(42);
      const targetInput = await screen.findByRole('textbox', { name: /^target$/i });
      fireEvent.change(targetInput, { target: { value: 'world:siege' } });
      fireEvent.change(screen.getByRole('combobox', { name: /^verb$/i }), { target: { value: 'set_flag' } });
      fireEvent.click(screen.getByRole('button', { name: /^effekt hinzufügen$/i }));
      await waitFor(() =>
        expect(addEffect).toHaveBeenCalledWith(
          mockDb, 'event-1',
          expect.objectContaining({ target: 'world:siege', verb: 'set_flag', day: 42 }),
        ),
      );
    });
  });

  describe('invalid target/verb (S08) is marked and blocks "hinzufügen"', () => {
    it('an unparseable target ("bogus", no scope prefix) disables the add button', async () => {
      renderEditor(42);
      const targetInput = await screen.findByRole('textbox', { name: /^target$/i });
      fireEvent.change(targetInput, { target: { value: 'bogus' } });
      expect(screen.getByRole('button', { name: /^effekt hinzufügen$/i })).toBeDisabled();
    });

    it('an unparseable target never calls addEffect', async () => {
      const { addEffect } = await import('../src/services/event-effects-service');
      renderEditor(42);
      const targetInput = await screen.findByRole('textbox', { name: /^target$/i });
      fireEvent.change(targetInput, { target: { value: 'bogus' } });
      fireEvent.click(screen.getByRole('button', { name: /^effekt hinzufügen$/i }));
      expect(addEffect).not.toHaveBeenCalled();
    });
  });

  describe('removing an effect', () => {
    it('clicking "entfernen" on an existing effect calls removeEffect with its index', async () => {
      const { listEffects, removeEffect } = await import('../src/services/event-effects-service');
      (listEffects as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
        { day: 42, target: 'world:siege', verb: 'set_flag' },
      ]);
      renderEditor(42);
      const removeBtn = await screen.findByRole('button', { name: /^entfernen$/i });
      fireEvent.click(removeBtn);
      await waitFor(() => expect(removeEffect).toHaveBeenCalledWith(mockDb, 'event-1', 0));
    });
  });

  describe('no raw HTML interpolation of user strings', () => {
    it('EffectEditor.tsx does not use dangerouslySetInnerHTML', () => {
      const src = readFileSync('src/ui/EffectEditor.tsx', 'utf-8');
      expect(src).not.toMatch(/dangerouslySetInnerHTML/);
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('EffectEditor.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/EffectEditor.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
