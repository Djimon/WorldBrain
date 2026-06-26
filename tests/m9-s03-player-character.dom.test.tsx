// M9-S03: Player Character Schema & UI
// See: https://github.com/Djimon/WorldBrain/issues/166

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  addLogEntry: vi.fn(),
}));

import { PlayerCharacterSheet } from '../src/ui/PlayerCharacterSheet';

const MOCK_SYSTEM_PLUGIN = {
  id: 'dnd5e',
  playerCharacterFields: [
    { id: 'str', label: 'Stärke', type: 'number', section: 'attributes' },
    { id: 'dex', label: 'Geschicklichkeit', type: 'number', section: 'attributes' },
    { id: 'hp', label: 'Trefferpunkte', type: 'number', section: 'resources', editable_in_play: true },
    { id: 'spell_slots_1', label: 'Spell Slots 1', type: 'number', section: 'resources', editable_in_play: true },
  ],
};

const MOCK_CHARACTER = {
  id: 'pc-1',
  name: 'Aria Windrunner',
  is_player_character: true,
  player_name: 'Max',
  note: 'Elfen-Schurkin',
  str: 10, dex: 18, hp: 42, spell_slots_1: 4,
};

describe('M9-S03 player character schema & UI', () => {
  describe('base fields always present', () => {
    it('shows character name', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={null} sessionId="s1" inPlayMode={false} />);
      expect(screen.getByText(/Aria Windrunner/i)).toBeInTheDocument();
    });

    it('shows player name', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={null} sessionId="s1" inPlayMode={false} />);
      expect(screen.getByText(/Max/i)).toBeInTheDocument();
    });

    it('shows Freinotiz field', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={null} sessionId="s1" inPlayMode={false} />);
      expect(screen.getByText(/Elfen-Schurkin/i)).toBeInTheDocument();
    });
  });

  describe('without system plugin', () => {
    it('shows only base fields (no attribute section) when no system plugin', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={null} sessionId="s1" inPlayMode={false} />);
      expect(screen.queryByText(/Stärke|str/i)).not.toBeInTheDocument();
    });
  });

  describe('with system plugin', () => {
    it('shows Basis-Attribute section from system plugin', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={MOCK_SYSTEM_PLUGIN} sessionId="s1" inPlayMode={false} />);
      expect(screen.getByText(/Stärke/i)).toBeInTheDocument();
    });

    it('shows Ressourcen section (HP, Spell Slots)', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={MOCK_SYSTEM_PLUGIN} sessionId="s1" inPlayMode={false} />);
      expect(screen.getByText(/Trefferpunkte|HP/i)).toBeInTheDocument();
    });
  });

  describe('play mode editing', () => {
    it('resource fields are editable in play mode', () => {
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={MOCK_SYSTEM_PLUGIN} sessionId="s1" inPlayMode={true} />);
      const hpInputs = screen.getAllByRole('spinbutton');
      expect(hpInputs.length).toBeGreaterThan(0);
    });

    it('changing HP in play mode adds a session log entry', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      const mockAdd = addLogEntry as ReturnType<typeof vi.fn>;
      mockAdd.mockClear();
      render(<PlayerCharacterSheet character={MOCK_CHARACTER} systemPlugin={MOCK_SYSTEM_PLUGIN} sessionId="s1" inPlayMode={true} />);
      const hpInput = screen.getAllByRole('spinbutton')[0];
      fireEvent.change(hpInput, { target: { value: '38' } });
      fireEvent.blur(hpInput);
      expect(mockAdd).toHaveBeenCalled();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('PlayerCharacterSheet.tsx does not use window.prompt, alert or confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/PlayerCharacterSheet.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
