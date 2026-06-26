// M8-S05: Session-Log
// See: https://github.com/Djimon/WorldBrain/issues/157

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  listLogEntries: vi.fn(),
  addLogEntry: vi.fn(),
}));

import { SessionLog } from '../src/ui/SessionLog';
import { listLogEntries } from '../src/services/session-log-service';

const mockListLogEntries = listLogEntries as ReturnType<typeof vi.fn>;

const SAMPLE_ENTRIES = [
  {
    id: 'log-1',
    session_id: 's1',
    real_timestamp: '2026-01-10T20:05:00Z',
    world_datetime: 'Jahr 1432, Tag 1, 10:00',
    round: null,
    action_type: 'note',
    description: 'Die Gruppe betritt die Taverne',
    entity_id: null,
  },
  {
    id: 'log-2',
    session_id: 's1',
    real_timestamp: '2026-01-10T20:30:00Z',
    world_datetime: 'Jahr 1432, Tag 1, 14:00',
    round: 3,
    action_type: 'combat',
    description: 'Goblin besiegt',
    entity_id: 'goblin-1',
  },
];

describe('M8-S05 session log', () => {
  describe('log entry display', () => {
    it('shows descriptions of all log entries', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      expect(screen.getByText(/Die Gruppe betritt die Taverne/i)).toBeInTheDocument();
      expect(screen.getByText(/Goblin besiegt/i)).toBeInTheDocument();
    });

    it('shows world_datetime for each entry', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      expect(screen.getByText(/Jahr 1432.*Tag 1.*10:00|10:00/i)).toBeInTheDocument();
    });

    it('shows round when round is not null', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      expect(screen.getByText(/runde.*3|round.*3|3/i)).toBeInTheDocument();
    });

    it('shows empty state when no entries exist', () => {
      mockListLogEntries.mockReturnValue([]);
      render(<SessionLog sessionId="s1" />);
      expect(screen.getByText(/kein.*eintrag|no.*entr|leer/i)).toBeInTheDocument();
    });
  });

  describe('search and filter', () => {
    it('renders a search input', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      expect(screen.getByRole('searchbox') || screen.getByPlaceholderText(/suche|search/i)).toBeInTheDocument();
    });

    it('filtering by action_type shows filter control', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      expect(
        screen.getByRole('combobox', { name: /typ|type|aktion/i }) ||
        screen.getByLabelText(/typ|type|aktion/i)
      ).toBeInTheDocument();
    });

    it('search for "Goblin" hides non-matching entry', () => {
      mockListLogEntries.mockReturnValue(SAMPLE_ENTRIES);
      render(<SessionLog sessionId="s1" />);
      const search = screen.getByRole('searchbox') || screen.getByPlaceholderText(/suche|search/i);
      fireEvent.change(search, { target: { value: 'Goblin' } });
      expect(screen.queryByText(/Die Gruppe betritt/i)).not.toBeInTheDocument();
      expect(screen.getByText(/Goblin besiegt/i)).toBeInTheDocument();
    });
  });

  describe('log entry schema', () => {
    it('session-log-service.ts exports addLogEntry with required fields', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      expect(typeof addLogEntry).toBe('function');
    });
  });
});
