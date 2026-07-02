// M8-S02: Session-Liste & Verwaltung
// See: https://github.com/Djimon/WorldBrain/issues/153

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-service', () => ({
  listSessions: vi.fn(async () => []),
  createSession: vi.fn(async () => null),
  archiveSession: vi.fn(async () => undefined),
}));

import { SessionList } from '../src/ui/SessionList';
import { listSessions, createSession, archiveSession } from '../src/services/session-service';

const mockListSessions = listSessions as ReturnType<typeof vi.fn>;
const mockCreateSession = createSession as ReturnType<typeof vi.fn>;
const mockArchiveSession = archiveSession as ReturnType<typeof vi.fn>;

const SAMPLE_SESSIONS = [
  {
    id: 's1',
    title: 'Der erste Abend',
    created_at: '2026-01-10T20:00:00Z',
    last_active_at: '2026-01-10T23:30:00Z',
    calendar_position: 'Jahr 1432, Tag 1',
    system_plugin_id: 'dnd5e-srd',
    archived: false,
    active: false,
  },
  {
    id: 's2',
    title: 'Zweite Session',
    created_at: '2026-01-17T20:00:00Z',
    last_active_at: '2026-01-17T22:15:00Z',
    calendar_position: null,
    system_plugin_id: null,
    archived: false,
    active: true,
  },
];

describe('M8-S02 session list & management', () => {
  describe('session list display', () => {
    it('shows session titles', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/Der erste Abend/i)).toBeInTheDocument());
      expect(screen.getByText(/Zweite Session/i)).toBeInTheDocument();
    });

    it('shows created date for each session', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/2026-01-10|Jan.*2026|10\.01\.2026/i)).toBeInTheDocument());
    });

    it('shows last_active_at for each session', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/23:30|2026-01-10T23/i)).toBeInTheDocument());
    });

    it('shows calendar_position when set', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/Jahr 1432/i)).toBeInTheDocument());
    });

    it('shows system plugin name when set', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/dnd5e-srd/i)).toBeInTheDocument());
    });

    it('shows empty state message when no sessions exist', async () => {
      mockListSessions.mockResolvedValue([]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByText(/keine session|no session/i)).toBeInTheDocument());
    });
  });

  describe('resume session', () => {
    it('each session has a resume / fortsetzen button', async () => {
      mockListSessions.mockResolvedValue(SAMPLE_SESSIONS);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getAllByRole('button', { name: /fortsetzen|resume/i }).length).toBeGreaterThanOrEqual(1));
    });

    it('clicking resume calls onResumeSession with session id', async () => {
      const onResume = vi.fn();
      mockListSessions.mockResolvedValue([SAMPLE_SESSIONS[0]]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={onResume} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /fortsetzen|resume/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /fortsetzen|resume/i }));
      expect(onResume).toHaveBeenCalledWith('s1');
    });
  });

  describe('new session form', () => {
    it('renders "Neue Session" button', () => {
      mockListSessions.mockResolvedValue([]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      expect(screen.getByRole('button', { name: /neue session/i })).toBeInTheDocument();
    });

    it('clicking "Neue Session" reveals title input', () => {
      mockListSessions.mockResolvedValue([]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /neue session/i }));
      expect(screen.getByRole('textbox', { name: /titel|title/i })).toBeInTheDocument();
    });

    it('title input is required — empty submit does not call createSession', () => {
      mockListSessions.mockResolvedValue([]);
      mockCreateSession.mockClear();
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /neue session/i }));
      fireEvent.click(screen.getByRole('button', { name: /erstellen|anlegen|create/i }));
      expect(mockCreateSession).not.toHaveBeenCalled();
    });

    it('submitting with title calls createSession with title and projectId', async () => {
      mockListSessions.mockResolvedValue([]);
      mockCreateSession.mockResolvedValue({ id: 'new-s', title: 'Night 3', archived: false });
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /neue session/i }));
      fireEvent.change(screen.getByRole('textbox', { name: /titel|title/i }), { target: { value: 'Night 3' } });
      fireEvent.click(screen.getByRole('button', { name: /erstellen|anlegen|create/i }));
      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledWith(expect.objectContaining({ title: 'Night 3', projectId: 'proj-1' })));
    });

    it('form has optional system-plugin selector', () => {
      mockListSessions.mockResolvedValue([]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /neue session/i }));
      expect(screen.getByRole('combobox', { name: /system.plugin/i }) || screen.queryByLabelText(/system.plugin/i)).toBeTruthy();
    });
  });

  describe('archive', () => {
    it('each session has an archive / archivieren button', async () => {
      mockListSessions.mockResolvedValue([SAMPLE_SESSIONS[0]]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /archiv/i })).toBeInTheDocument());
    });

    it('clicking archive calls archiveSession with session id', async () => {
      mockArchiveSession.mockClear();
      mockListSessions.mockResolvedValue([SAMPLE_SESSIONS[0]]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      await waitFor(() => expect(screen.getByRole('button', { name: /archiv/i })).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: /archiv/i }));
      await waitFor(() => expect(mockArchiveSession).toHaveBeenCalledWith(expect.objectContaining({ sessionId: 's1' })));
    });
  });

  describe('archive view', () => {
    it('renders "Archiv anzeigen" toggle', () => {
      mockListSessions.mockResolvedValue([]);
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      expect(screen.getByRole('button', { name: /archiv anzeigen|show archive/i })).toBeInTheDocument();
    });

    it('archive view shows archived sessions', async () => {
      mockListSessions.mockImplementation(async ({ includeArchived }: { includeArchived?: boolean }) =>
        includeArchived ? [{ ...SAMPLE_SESSIONS[0], archived: true }] : []
      );
      render(<SessionList projectId="proj-1" projectDir="/p" onResumeSession={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /archiv anzeigen|show archive/i }));
      await waitFor(() => expect(screen.getByText(/Der erste Abend/i)).toBeInTheDocument());
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('SessionList.tsx does not use window.prompt, alert or confirm', () => {
      const src = readFileSync('src/ui/SessionList.tsx', 'utf-8');
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
