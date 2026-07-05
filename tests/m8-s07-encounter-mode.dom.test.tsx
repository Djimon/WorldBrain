// M8-S07: Encounter-Modus
// See: https://github.com/Djimon/WorldBrain/issues/159

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  listLogEntries: vi.fn(async () => []),
  addLogEntry: vi.fn(async () => undefined),
}));

import { EncounterMode } from '../src/ui/EncounterMode';
import { addLogEntry } from '../src/services/session-log-service';

const mockAddLogEntry = addLogEntry as ReturnType<typeof vi.fn>;

const mockDb = {
  execute: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
};

const SAMPLE_ENCOUNTERS = [
  { id: 'enc-1', title: 'Goblin Ambush', type: 'encounter', linked_location: 'forest-road', group: 'Abend 1' },
  { id: 'enc-2', title: 'Dragon Lair', type: 'encounter', linked_location: 'cave', group: 'Abend 2' },
  { id: 'enc-3', title: 'Tavern Brawl', type: 'encounter', linked_location: null, group: null },
];

describe('M8-S07 encounter mode', () => {
  describe('encounter list', () => {
    it('renders list of encounter maps', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={SAMPLE_ENCOUNTERS} onEncounterEnd={vi.fn()} />);
      expect(screen.getByText(/Goblin Ambush/i)).toBeInTheDocument();
      expect(screen.getByText(/Dragon Lair/i)).toBeInTheDocument();
    });

    it('shows GM helper groups as headings/groups', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={SAMPLE_ENCOUNTERS} onEncounterEnd={vi.fn()} />);
      expect(screen.getByText(/Abend 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Abend 2/i)).toBeInTheDocument();
    });

    it('renders filter input for linked location', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={SAMPLE_ENCOUNTERS} onEncounterEnd={vi.fn()} />);
      expect(
        screen.queryByRole('textbox', { name: /ort|location|filter/i }) ??
        screen.queryByPlaceholderText(/ort|location|filter/i)
      ).toBeInTheDocument();
    });

    it('filtering by location hides non-matching encounters', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={SAMPLE_ENCOUNTERS} onEncounterEnd={vi.fn()} />);
      const filter = screen.queryByRole('textbox', { name: /ort|location|filter/i }) ??
                     screen.getByPlaceholderText(/ort|location|filter/i);
      fireEvent.change(filter, { target: { value: 'forest' } });
      expect(screen.getByText(/Goblin Ambush/i)).toBeInTheDocument();
      expect(screen.queryByText(/Dragon Lair/i)).not.toBeInTheDocument();
    });
  });

  describe('starting an encounter', () => {
    it('each encounter has "Encounter starten" button', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={[SAMPLE_ENCOUNTERS[0]]} onEncounterEnd={vi.fn()} />);
      expect(screen.getByRole('button', { name: /encounter starten|start/i })).toBeInTheDocument();
    });

    it('clicking "Encounter starten" opens encounter as a tab/panel', () => {
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={[SAMPLE_ENCOUNTERS[0]]} onEncounterEnd={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /encounter starten|start/i }));
      expect(screen.getByText(/Goblin Ambush/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /encounter beenden|end/i })).toBeInTheDocument();
    });
  });

  describe('ending an encounter', () => {
    it('"Encounter beenden" adds a log entry', async () => {
      mockAddLogEntry.mockClear();
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={[SAMPLE_ENCOUNTERS[0]]} onEncounterEnd={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /encounter starten|start/i }));
      fireEvent.click(screen.getByRole('button', { name: /encounter beenden|end/i }));
      await waitFor(() =>
        expect(mockAddLogEntry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action_type: expect.stringMatching(/encounter|combat/i) }))
      );
    });

    it('"Encounter beenden" calls onEncounterEnd', async () => {
      const onEnd = vi.fn();
      render(<EncounterMode database={mockDb as never} sessionId="s1" encounters={[SAMPLE_ENCOUNTERS[0]]} onEncounterEnd={onEnd} />);
      fireEvent.click(screen.getByRole('button', { name: /encounter starten|start/i }));
      fireEvent.click(screen.getByRole('button', { name: /encounter beenden|end/i }));
      await waitFor(() => expect(onEnd).toHaveBeenCalled());
    });
  });

  describe('database prop convention (AP-001)', () => {
    it('EncounterMode accepts DatabaseLike-shaped object without as-never cast', () => {
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      expect(() => render(<EncounterMode database={db} sessionId="s1" encounters={SAMPLE_ENCOUNTERS} onEncounterEnd={vi.fn()} />)).not.toThrow();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('EncounterMode.tsx does not use window.prompt, alert or confirm', () => {
      const src = readFileSync('src/ui/EncounterMode.tsx', 'utf-8');
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
