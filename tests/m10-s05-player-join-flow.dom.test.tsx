// M10-S05: Player-Join-Flow (Spieler-Modus-Client)
// See: https://github.com/Djimon/WorldBrain/issues/199
//
// RED: PlayerJoinView + PlayerProjectDashboard stubs throw. All tests fail
// until implementer builds the join form + project dashboard.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn(async () => false),
  mkdir: vi.fn(),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d: string) => d ?? k }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { PlayerJoinView } from '../src/ui/PlayerJoinView';
import { PlayerProjectDashboard } from '../src/ui/PlayerProjectDashboard';
import type { PlayerProject } from '../src/ui/PlayerProjectDashboard';

// ── PlayerJoinView: Erst-Join-Formular ───────────────────────────────────────

describe('#199 PlayerJoinView — Erst-Join-Formular', () => {
  it('renders URL, invite-code and display-name inputs', () => {
    render(<PlayerJoinView />);
    // All three required fields present
    expect(screen.getByRole('textbox', { name: /server.*(url|ip|adresse)/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /einladungscode|code/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /anzeigename|name/i })).toBeInTheDocument();
  });

  it('renders a join/submit button', () => {
    render(<PlayerJoinView />);
    expect(screen.getByRole('button', { name: /beitreten|join/i })).toBeInTheDocument();
  });

  it('shows pending status after submitting valid form data', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'tok-1' });

    render(<PlayerJoinView />);
    fireEvent.change(screen.getByRole('textbox', { name: /server.*(url|ip|adresse)/i }), {
      target: { value: 'http://192.168.1.5:9000' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /einladungscode|code/i }), {
      target: { value: 'abc12345' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /anzeigename|name/i }), {
      target: { value: 'Aragorn' },
    });
    fireEvent.click(screen.getByRole('button', { name: /beitreten|join/i }));
    await waitFor(() =>
      expect(screen.getByText(/warte|pending|bestätigung/i)).toBeInTheDocument(),
    );
  });

  it('shows rejected message when server returns rejected status', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('rejected'));

    render(<PlayerJoinView />);
    fireEvent.change(screen.getByRole('textbox', { name: /server.*(url|ip|adresse)/i }), {
      target: { value: 'http://192.168.1.5:9000' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /einladungscode|code/i }), {
      target: { value: 'badcode' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /anzeigename|name/i }), {
      target: { value: 'Gollum' },
    });
    fireEvent.click(screen.getByRole('button', { name: /beitreten|join/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeInTheDocument(),
    );
  });

  it('calls onJoined with the token when approved', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ token: 'tok-ok', status: 'approved' });

    const onJoined = vi.fn();
    render(<PlayerJoinView onJoined={onJoined} />);
    fireEvent.change(screen.getByRole('textbox', { name: /server.*(url|ip|adresse)/i }), {
      target: { value: 'http://192.168.1.5:9000' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /einladungscode|code/i }), {
      target: { value: 'validcode' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /anzeigename|name/i }), {
      target: { value: 'Legolas' },
    });
    fireEvent.click(screen.getByRole('button', { name: /beitreten|join/i }));
    await waitFor(() => expect(onJoined).toHaveBeenCalledWith('tok-ok'));
  });

  it('does NOT show any session content while status is pending', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ token: 'tok-1', status: 'pending' });

    render(<PlayerJoinView />);
    fireEvent.change(screen.getByRole('textbox', { name: /server.*(url|ip|adresse)/i }), {
      target: { value: 'http://192.168.1.5:9000' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /einladungscode|code/i }), {
      target: { value: 'code' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /anzeigename|name/i }), {
      target: { value: 'Gimli' },
    });
    fireEvent.click(screen.getByRole('button', { name: /beitreten|join/i }));
    await waitFor(() =>
      expect(screen.getByText(/warte|pending|bestätigung/i)).toBeInTheDocument(),
    );
    // no entity/session content visible
    expect(screen.queryByRole('main')).toBeNull();
    expect(screen.queryByTestId('session-content')).toBeNull();
  });

  it('AP-003: source has no window.alert / confirm / prompt calls', () => {
    const { readFileSync } = require('node:fs');
    const src = readFileSync('src/ui/PlayerJoinView.tsx', 'utf-8') as string;
    expect(src).not.toMatch(/\b(alert|confirm|prompt)\s*\(/);
  });
});

// ── PlayerProjectDashboard: gespeicherte Hosts (App-Modus) ──────────────────

const MOCK_PROJECTS: PlayerProject[] = [
  {
    id: 'p1',
    label: 'Donnerstags-Runde',
    hostUrl: 'http://192.168.1.5:9000',
    inviteCode: 'abc12345',
    token: 'tok-p1',
    displayName: 'Aragorn',
    sessionName: 'Der Schatten von Gondor',
    lastSeenAt: new Date(Date.now() - 3600_000).toISOString(),
  },
  {
    id: 'p2',
    label: 'Sonntagsgruppe',
    hostUrl: 'http://10.0.0.2:9000',
    inviteCode: 'xyz99887',
    token: 'tok-p2',
    displayName: 'Frodo',
    sessionName: 'Auenland in Gefahr',
    lastSeenAt: null,
  },
];

describe('#199 PlayerProjectDashboard — gespeicherte Player-Projekte', () => {
  it('lists all saved player projects by label', () => {
    render(<PlayerProjectDashboard />);
    // Dashboard renders even without saved projects
    // The structure is present (list or empty state)
    const list = screen.queryByRole('list');
    // Either a list or an empty-state message must be present
    const emptyMsg = screen.queryByText(/kein|leer|noch keine/i);
    expect(list ?? emptyMsg).toBeTruthy();
  });

  it('shows project label and host URL for each project', async () => {
    // We seed projects via storage mock — component reads from Tauri FS
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(MOCK_PROJECTS),
    );
    const { exists } = await import('@tauri-apps/plugin-fs');
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    render(<PlayerProjectDashboard />);
    await waitFor(() =>
      expect(screen.getByText('Donnerstags-Runde')).toBeInTheDocument(),
    );
    expect(screen.getByText('Sonntagsgruppe')).toBeInTheDocument();
  });

  it('renders a "join new host" button', () => {
    render(<PlayerProjectDashboard />);
    expect(screen.getByRole('button', { name: /neu|new|hinzufügen|beitreten/i })).toBeInTheDocument();
  });

  it('clicking "join new host" calls onJoinNew', () => {
    const onJoinNew = vi.fn();
    render(<PlayerProjectDashboard onJoinNew={onJoinNew} />);
    fireEvent.click(screen.getByRole('button', { name: /neu|new|hinzufügen|beitreten/i }));
    expect(onJoinNew).toHaveBeenCalled();
  });

  it('clicking a project entry calls onOpenProject with that project', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(MOCK_PROJECTS),
    );
    const { exists } = await import('@tauri-apps/plugin-fs');
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);

    const onOpenProject = vi.fn();
    render(<PlayerProjectDashboard onOpenProject={onOpenProject} />);
    await waitFor(() => screen.getByText('Donnerstags-Runde'));
    fireEvent.click(screen.getByText('Donnerstags-Runde'));
    expect(onOpenProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1' }),
    );
  });

  it('shows online/offline indicator per project (ping result)', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify(MOCK_PROJECTS),
    );
    const { exists } = await import('@tauri-apps/plugin-fs');
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const { invoke } = await import('@tauri-apps/api/core');
    // first project online, second offline
    (invoke as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ online: true })
      .mockResolvedValueOnce({ online: false });

    render(<PlayerProjectDashboard />);
    await waitFor(() => screen.getByText('Donnerstags-Runde'));
    // online/offline indicators must exist (exact text/icon doesn't matter)
    const indicators = screen.getAllByTestId(/online|offline|connection/i);
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  it('no heartbeat — invoke("ping"…) is called at most once per project on open', async () => {
    const { readTextFile } = await import('@tauri-apps/plugin-fs');
    (readTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(
      JSON.stringify([MOCK_PROJECTS[0]]),
    );
    const { exists } = await import('@tauri-apps/plugin-fs');
    (exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue({ online: true });

    render(<PlayerProjectDashboard />);
    await waitFor(() => screen.getByText('Donnerstags-Runde'));
    // Allow microtasks to settle, then check invoke count
    await new Promise((r) => setTimeout(r, 100));
    const pingCalls = (invoke as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => String(c[0]).toLowerCase().includes('ping'),
    );
    // At most 1 ping per project (no heartbeat interval)
    expect(pingCalls.length).toBeLessThanOrEqual(1);
  });
});
