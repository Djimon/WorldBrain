// M8-S05: Session-Log
// See: https://github.com/Djimon/WorldBrain/issues/157

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  listLogEntries: vi.fn(async () => []),
  addLogEntry: vi.fn(async () => undefined),
}));

import { SessionLog } from '../src/ui/SessionLog';
import { listLogEntries } from '../src/services/session-log-service';

const mockListLogEntries = listLogEntries as ReturnType<typeof vi.fn>;

const mockDb = {
  execute: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
};

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
    it('shows descriptions of all log entries', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() => expect(screen.getByText(/Die Gruppe betritt die Taverne/i)).toBeInTheDocument());
      expect(screen.getByText(/Goblin besiegt/i)).toBeInTheDocument();
    });

    it('shows world_datetime for each entry', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() => expect(screen.getByText(/Jahr 1432.*Tag 1.*10:00/i)).toBeInTheDocument());
    });

    it('shows round when round is not null', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() => expect(screen.getByText(/runde\s*3\b|\(3\)/i)).toBeInTheDocument());
    });

    it('shows empty state when no entries exist', async () => {
      mockListLogEntries.mockResolvedValue([]);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() => expect(screen.getByText(/kein.*eintrag|no.*entr|leer/i)).toBeInTheDocument());
    });
  });

  describe('search and filter', () => {
    it('renders a search input', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() =>
        expect(
          screen.queryByRole('searchbox') ?? screen.queryByPlaceholderText(/suche|search/i)
        ).toBeInTheDocument()
      );
    });

    it('filtering by action_type shows filter control', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() =>
        expect(
          screen.queryByRole('combobox', { name: /typ|type|aktion/i }) ??
          screen.queryByLabelText(/typ|type|aktion/i)
        ).toBeInTheDocument()
      );
    });

    it('search for "Goblin" hides non-matching entry', async () => {
      mockListLogEntries.mockResolvedValue(SAMPLE_ENTRIES);
      render(<SessionLog database={mockDb as never} sessionId="s1" />);
      await waitFor(() => expect(screen.getByText(/Die Gruppe betritt die Taverne/i)).toBeInTheDocument());
      const search = screen.queryByRole('searchbox') ?? screen.getByPlaceholderText(/suche|search/i);
      fireEvent.change(search, { target: { value: 'Goblin' } });
      await waitFor(() => expect(screen.queryByText(/Die Gruppe betritt/i)).not.toBeInTheDocument());
      expect(screen.getByText(/Goblin besiegt/i)).toBeInTheDocument();
    });
  });

  describe('database prop convention (AP-001)', () => {
    it('accepts a DatabaseLike-shaped object without as-never cast', () => {
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      expect(() => render(<SessionLog database={db} sessionId="s1" />)).not.toThrow();
    });
  });

  describe('log entry schema', () => {
    it('session-log-service.ts exports addLogEntry', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      expect(typeof addLogEntry).toBe('function');
    });
  });
});
