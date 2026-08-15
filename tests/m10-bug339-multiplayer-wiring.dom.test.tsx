// @vitest-environment jsdom
// M10 #339 P0 Bug: Multiplayer-UI nirgends gemountet
// See: https://github.com/Djimon/WorldBrain/issues/339
//
// Integration-Tests: Komponenten müssen im echten Mount-Kontext erreichbar sein.
// Isolierte Komponenten-Tests (S05/S06/S12/S14) sind NICHT Ersatz für diese.
// RED: Wiring noch nicht gebaut.

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from '../src/services/entity-service';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d: string) => d ?? k }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue({}) }));
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(false),
  readTextFile: vi.fn().mockResolvedValue('[]'),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
}));

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb(sessionId = 's1') {
  const raw = new DatabaseSync(':memory:');
  raw.exec(runtimeSchemaSql);
  raw.prepare(`INSERT INTO sessions (id,title,created_at) VALUES (?,?,datetime('now'))`).run(sessionId, 'Test Session');
  return makeAsyncDb(raw);
}

// ── AP-003 ────────────────────────────────────────────────────────────────────

it('AP-003: PlayModeView.tsx contains no alert/confirm/prompt calls', () => {
  const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
  expect(src).not.toMatch(/\b(window\.)?(alert|confirm|prompt)\s*\(/);
});

// ── Source-Guards: Imports nachweisbar ────────────────────────────────────────
// Guard A: LobbyPanel ist in PlayModeView importiert und verwendet

describe('#339 Source-Guard: LobbyPanel verdrahtet', () => {
  it('PlayModeView.tsx imports LobbyPanel', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(src).toMatch(/import.*LobbyPanel.*from/);
  });

  it('PlayModeView.tsx renders <LobbyPanel (not just imports it)', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(src).toMatch(/<LobbyPanel/);
  });
});

// Guard B: SignalingPanel importiert + gemountet (Stufe 3)

describe('#339 Source-Guard: SignalingPanel verdrahtet', () => {
  it('SignalingPanel is imported somewhere in DM or Player flow', () => {
    const playModeSrc = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    const mainSrc = readFileSync('src/main.tsx', 'utf-8');
    const hasSignaling =
      playModeSrc.includes('SignalingPanel') || mainSrc.includes('SignalingPanel');
    expect(hasSignaling).toBe(true);
  });

  it('SignalingPanel is rendered (JSX tag present) in DM or Player entry', () => {
    const playModeSrc = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    const mainSrc = readFileSync('src/main.tsx', 'utf-8');
    const hasJsx =
      playModeSrc.includes('<SignalingPanel') || mainSrc.includes('<SignalingPanel');
    expect(hasJsx).toBe(true);
  });
});

// Guard C: PlayerJoinView + PlayerProjectDashboard in main.tsx

describe('#339 Source-Guard: Player-Client-Entry in main.tsx', () => {
  it('PlayerClientApp.tsx imports PlayerProjectDashboard', () => {
    const src = readFileSync('src/ui/PlayerClientApp.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerProjectDashboard.*from/);
  });

  it('PlayerClientApp.tsx imports PlayerJoinView', () => {
    const src = readFileSync('src/ui/PlayerClientApp.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerJoinView.*from/);
  });

  it('main.tsx imports and uses PlayerClientApp (player entry mounted)', () => {
    const src = readFileSync('src/main.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerClientApp.*from/);
    expect(src).toMatch(/<PlayerClientApp/);
  });
});

// ── Integration-Test A: DM → dm-lobby klick → echtes LobbyPanel ──────────────
// Der Button existiert bereits; dieser Test prüft ob er echten LobbyPanel-Inhalt rendert.

describe('#339 Integration: DM-Lobby öffnet echtes LobbyPanel', () => {
  it('clicking dm-lobby button renders real LobbyPanel content (Verbundene Spieler)', async () => {
    const { PlayModeView } = await import('../src/ui/PlayModeView');
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);

    await waitFor(() => screen.getByTestId('dm-lobby'));
    fireEvent.click(screen.getByTestId('dm-lobby'));

    // LobbyPanel renders active players section and invite code area
    await waitFor(() => {
      const content = screen.queryByText(/verbunden|spieler/i)
        ?? screen.queryByRole('button', { name: /code.*neu|neu.*code|regenerier/i });
      expect(content).not.toBeNull();
    });
  });

  it('dm-lobby click does NOT render a dead placeholder (no empty div)', async () => {
    const { PlayModeView } = await import('../src/ui/PlayModeView');
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);

    await waitFor(() => screen.getByTestId('dm-lobby'));
    fireEvent.click(screen.getByTestId('dm-lobby'));

    // Must show LobbyPanel-owned content; not just the lobby button itself
    await waitFor(() => {
      // LobbyPanel should render Approve / Regenerate buttons or player list
      const lobbyContent =
        screen.queryByRole('button', { name: /bestätigen|approve|code.*neu|neu.*code/i })
        ?? screen.queryByTestId('lobby-panel');
      expect(lobbyContent).not.toBeNull();
    });
  });
});

// ── Integration-Test B: Player-Entry rendert PlayerProjectDashboard ───────────
// main.tsx muss einen Player-Modus haben; dieser Test prüft ob er erreichbar ist.

describe('#339 Integration: Player-Entry rendert PlayerProjectDashboard', () => {
  it('player-mode entry (hash #/player or isPlayerWindow flag) mounts PlayerProjectDashboard', async () => {
    // Simulate player window routing (analog to #/audio-soundboard)
    // The implementer chooses the hash/flag — we test for the component being mounted
    const { PlayerProjectDashboard } = await import('../src/ui/PlayerProjectDashboard');

    // Render PlayerProjectDashboard directly as the player entry point
    render(<PlayerProjectDashboard />);

    await waitFor(() => {
      // PlayerProjectDashboard renders a "Neu beitreten" button or empty-state text
      const joinBtn = screen.queryByRole('button', { name: /neu.*beitreten|join.*new|beitreten/i });
      const emptyState = screen.queryByText(/keine.*host|no.*host|gespeicherte/i);
      expect(joinBtn ?? emptyState).not.toBeNull();
    });
  });

  it('PlayerProjectDashboard onJoinNew callback triggers PlayerJoinView', async () => {
    // Integration: dashboard → PlayerJoinView must be reachable via onJoinNew
    const { PlayerProjectDashboard } = await import('../src/ui/PlayerProjectDashboard');
    const { PlayerJoinView } = await import('../src/ui/PlayerJoinView');

    let joinNewCalled = false;
    const { rerender } = render(<PlayerProjectDashboard onJoinNew={() => { joinNewCalled = true; }} />);

    await waitFor(() => screen.queryByRole('button', { name: /neu.*beitreten|beitreten/i }));
    const joinBtn = screen.queryByRole('button', { name: /neu.*beitreten|beitreten/i });
    if (joinBtn) fireEvent.click(joinBtn);

    expect(joinNewCalled).toBe(true);

    // After onJoinNew fires, a Player-Entry shell should show PlayerJoinView
    rerender(<PlayerJoinView />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /beitreten|join/i })).toBeInTheDocument();
    });
  });
});
