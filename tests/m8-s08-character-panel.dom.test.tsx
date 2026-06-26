// M8-S08: Character-Panel
// See: https://github.com/Djimon/WorldBrain/issues/160

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  addLogEntry: vi.fn(),
}));

import { CharacterPanel } from '../src/ui/CharacterPanel';

const PLAYER_CHARACTERS = [
  {
    id: 'pc-1',
    name: 'Aria Windrunner',
    is_player_character: true,
    player_name: 'Max',
    note: 'Elfen-Schurkin',
    extra: { hp: 42, level: 5 },
  },
  {
    id: 'pc-2',
    name: 'Borin Stonefist',
    is_player_character: true,
    player_name: 'Lisa',
    note: '',
    extra: {},
  },
];

describe('M8-S08 character panel', () => {
  describe('character list', () => {
    it('shows all entities with is_player_character: true', () => {
      render(<CharacterPanel sessionId="s1" characters={PLAYER_CHARACTERS} systemPlugin={null} />);
      expect(screen.getByText(/Aria Windrunner/i)).toBeInTheDocument();
      expect(screen.getByText(/Borin Stonefist/i)).toBeInTheDocument();
    });

    it('shows player name for each character', () => {
      render(<CharacterPanel sessionId="s1" characters={PLAYER_CHARACTERS} systemPlugin={null} />);
      expect(screen.getByText(/Max/i)).toBeInTheDocument();
      expect(screen.getByText(/Lisa/i)).toBeInTheDocument();
    });

    it('shows Freinotiz field for each character', () => {
      render(<CharacterPanel sessionId="s1" characters={PLAYER_CHARACTERS} systemPlugin={null} />);
      expect(screen.getByText(/Elfen-Schurkin/i)).toBeInTheDocument();
    });

    it('shows empty state message when no player characters exist', () => {
      render(<CharacterPanel sessionId="s1" characters={[]} systemPlugin={null} />);
      expect(screen.getByText(/kein.*character|no.*character|keine spieler/i)).toBeInTheDocument();
    });
  });

  describe('without system plugin', () => {
    it('shows only base fields (Name, Spieler-Name, Freinotiz) when no system plugin', () => {
      render(<CharacterPanel sessionId="s1" characters={[PLAYER_CHARACTERS[0]]} systemPlugin={null} />);
      expect(screen.queryByText(/hp|hit points/i)).not.toBeInTheDocument();
    });
  });

  describe('with system plugin', () => {
    const MOCK_SYSTEM_PLUGIN = {
      id: 'dnd5e',
      playerCharacterFields: [
        { id: 'hp', label: 'HP', type: 'number' },
        { id: 'level', label: 'Level', type: 'number' },
      ],
    };

    it('shows system plugin fields when plugin is provided', () => {
      render(<CharacterPanel sessionId="s1" characters={[PLAYER_CHARACTERS[0]]} systemPlugin={MOCK_SYSTEM_PLUGIN} />);
      expect(screen.getByText(/HP/i)).toBeInTheDocument();
      expect(screen.getByText(/Level/i)).toBeInTheDocument();
    });
  });

  describe('field change logs', () => {
    it('changing a character field during session adds a log entry', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      const mockAdd = addLogEntry as ReturnType<typeof vi.fn>;
      mockAdd.mockClear();
      render(<CharacterPanel sessionId="s1" characters={[PLAYER_CHARACTERS[0]]} systemPlugin={null} />);
      const noteField = screen.getByDisplayValue(/Elfen-Schurkin/i) || screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(noteField, { target: { value: 'Updated note' } });
      fireEvent.blur(noteField);
      expect(mockAdd).toHaveBeenCalled();
    });
  });
});
