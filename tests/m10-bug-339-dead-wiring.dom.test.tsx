// @vitest-environment jsdom
// #339 P0: Multiplayer-UI Dead-Wiring — Integration Guard
// Verifies LobbyPanel/PlayerJoinView/PlayerProjectDashboard/SignalingPanel
// are imported + reachable through real mount paths.

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';

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

// ── Source-import guard ───────────────────────────────────────────────────────

describe('#339 Guard — alle Multiplayer-UI-Komponenten gemountet', () => {
  it('PlayModeView.tsx imports LobbyPanel', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(src).toMatch(/import.*LobbyPanel/);
  });

  it('PlayModeView.tsx imports SignalingPanel', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(src).toMatch(/import.*SignalingPanel/);
  });

  it('PlayerClientApp.tsx imports PlayerJoinView', () => {
    const src = readFileSync('src/ui/PlayerClientApp.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerJoinView/);
  });

  it('PlayerClientApp.tsx imports PlayerProjectDashboard', () => {
    const src = readFileSync('src/ui/PlayerClientApp.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerProjectDashboard/);
  });

  it('PlayerClientApp.tsx imports SignalingPanel', () => {
    const src = readFileSync('src/ui/PlayerClientApp.tsx', 'utf-8');
    expect(src).toMatch(/import.*SignalingPanel/);
  });

  it('main.tsx imports PlayerClientApp', () => {
    const src = readFileSync('src/main.tsx', 'utf-8');
    expect(src).toMatch(/import.*PlayerClientApp/);
  });
});

// ── DM Integration — Lobby reachable ─────────────────────────────────────────

const mockDb = {
  execute: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
};

describe('#339 DM Integration — LobbyPanel via PlayModeView', () => {
  it('clicking dm-lobby renders real LobbyPanel content (Verbundene Spieler)', async () => {
    const { PlayModeView } = await import('../src/ui/PlayModeView');
    render(<PlayModeView database={mockDb} sessionId="s1" role="dm" />);

    await waitFor(() => screen.getByTestId('dm-lobby'));
    fireEvent.click(screen.getByTestId('dm-lobby'));

    await waitFor(() => {
      expect(screen.getByText('Verbundene Spieler')).toBeInTheDocument();
    });
  });

  it('LobbyPanel inside PlayModeView has "Code neu generieren" button', async () => {
    const { PlayModeView } = await import('../src/ui/PlayModeView');
    render(<PlayModeView database={mockDb} sessionId="s1" role="dm" />);

    fireEvent.click(screen.getByTestId('dm-lobby'));

    await waitFor(() => {
      expect(screen.getByText('Code neu generieren')).toBeInTheDocument();
    });
  });
});

// ── Player Integration — Join flow reachable ──────────────────────────────────

describe('#339 Player Integration — PlayerClientApp → Join-Flow', () => {
  it('PlayerClientApp mounts PlayerProjectDashboard on load', async () => {
    const { PlayerClientApp } = await import('../src/ui/PlayerClientApp');
    render(<PlayerClientApp />);

    await waitFor(() => {
      expect(screen.getByText('Neu beitreten')).toBeInTheDocument();
    });
  });

  it('clicking "Neu beitreten" shows PlayerJoinView (Beitreten-Button)', async () => {
    const { PlayerClientApp } = await import('../src/ui/PlayerClientApp');
    render(<PlayerClientApp />);

    await waitFor(() => screen.getByText('Neu beitreten'));
    fireEvent.click(screen.getByText('Neu beitreten'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Beitreten' })).toBeInTheDocument();
    });
  });

  it('PlayerJoinView in join-flow has Einladungscode + Anzeigename fields', async () => {
    const { PlayerClientApp } = await import('../src/ui/PlayerClientApp');
    render(<PlayerClientApp />);

    await waitFor(() => screen.getByText('Neu beitreten'));
    fireEvent.click(screen.getByText('Neu beitreten'));

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Einladungscode/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /Anzeigename/i })).toBeInTheDocument();
    });
  });
});
