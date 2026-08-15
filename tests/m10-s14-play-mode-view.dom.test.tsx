// M10-S14: Play-Mode-Hauptfeld — Reiter Map / Kampflog / Spotlight + Free-Browse
// See: https://github.com/Djimon/WorldBrain/issues/332
//
// RED: PlayModeView stub throws. Tests fail until implementer builds the view.

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d: string) => d ?? k }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from '../src/services/entity-service';
import { PlayModeView } from '../src/ui/PlayModeView';

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  db.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s1','Runde',datetime('now'))`).run();
  return makeAsyncDb(db);
}

// ── Tabs present ──────────────────────────────────────────────────────────────

describe('#332 PlayModeView — drei Reiter (DM + Spieler)', () => {
  it('renders a Map tab', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /map|karte/i })).toBeInTheDocument(),
    );
  });

  it('renders a Kampflog tab', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /kampflog|combat.*log|log/i })).toBeInTheDocument(),
    );
  });

  it('renders a Spotlight tab', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /spotlight/i })).toBeInTheDocument(),
    );
  });

  it('player role also sees all three tabs', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="player" playerId="p1" />);
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /map|karte/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /kampflog|combat.*log|log/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /spotlight/i })).toBeInTheDocument();
    });
  });
});

// ── Tab switching ─────────────────────────────────────────────────────────────

describe('#332 PlayModeView — Tab-Switching', () => {
  it('clicking Map tab activates it (aria-selected=true)', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));
    fireEvent.click(screen.getByRole('tab', { name: /map|karte/i }));
    expect(screen.getByRole('tab', { name: /map|karte/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('clicking Kampflog tab activates it', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByRole('tab', { name: /kampflog|log/i }));
    fireEvent.click(screen.getByRole('tab', { name: /kampflog|log/i }));
    expect(screen.getByRole('tab', { name: /kampflog|log/i })).toHaveAttribute('aria-selected', 'true');
  });
});

// ── Free Browse ───────────────────────────────────────────────────────────────

describe('#332 PlayModeView — Free-Browse', () => {
  it('renders a free-browse section/panel', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="player" playerId="p1" />);
    await waitFor(() =>
      expect(screen.getByTestId('free-browse')).toBeInTheDocument(),
    );
  });
});

// ── DM-only areas NOT shown to players (D15) ─────────────────────────────────

describe('#332 PlayModeView — D15: DM-Only-Bereiche nicht für Spieler', () => {
  it('player role does not see an Authoring/Entities-editing button', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="player" playerId="p1" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));
    expect(screen.queryByRole('button', { name: /entity.*erstellen|neue.*entity|authoring/i })).toBeNull();
  });

  it('player role does not see the graph/knowledge-graph navigation', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="player" playerId="p1" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));
    expect(screen.queryByTestId('graph-nav')).toBeNull();
    expect(screen.queryByRole('button', { name: /graph|wissensgraph/i })).toBeNull();
  });

  it('dm role has full authoring access (no restriction)', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));
    // DM-mode: authoring button or link must be reachable
    expect(
      screen.queryByRole('button', { name: /entity.*erstellen|neue.*entity|authoring|welt/i })
      ?? screen.queryByTestId('dm-authoring'),
    ).toBeTruthy();
  });
});

// ── AP-003 ────────────────────────────────────────────────────────────────────

describe('#332 PlayModeView — AP-003', () => {
  it('source has no window.alert / confirm / prompt', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(alert|confirm|prompt)\s*\(/);
  });
});

// ── Mount-Guard: WorkspaceShell case 'session' verdrahtet PlayModeView ────────
// NACHSCHÄRFUNG: Play-Feld ersetzt den alten Widget-Stapel; PlayModeScreen raus.

describe('#332 NACHSCHÄRFUNG — Mount-Guard (WorkspaceShell)', () => {
  it('WorkspaceShell.tsx does NOT import PlayModeScreen (dead file removed)', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    expect(src).not.toMatch(/PlayModeScreen/);
  });

  it('WorkspaceShell case "session" source mounts PlayModeView (not the old widget stack)', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    // After NACHSCHÄRFUNG: case 'session' must reference PlayModeView, not CaptureInbox
    expect(src).toMatch(/case\s*['"]session['"]/);
    // The PlayModeView must be rendered in the session case
    expect(src).toMatch(/PlayModeView/);
    // The old dead widget-stack must be gone from the session branch
    // (CaptureInbox may exist elsewhere but must not be in case 'session')
    const sessionCaseMatch = src.match(/case\s*['"]session['"]\s*:[\s\S]*?(?=case\s*['"]|default\s*:|$)/);
    if (sessionCaseMatch) {
      expect(sessionCaseMatch[0]).not.toMatch(/CaptureInbox|EncounterCounters/);
    }
  });
});

// ── Modus-Wechsel: Create ↔ Play Toggle sichtbar ────────────────────────────
// NACHSCHÄRFUNG: Es muss einen klaren Einstiegspunkt in den Play-Mode geben.

describe('#332 NACHSCHÄRFUNG — Modus-Toggle', () => {
  it('WorkspaceShell defines a session nav entry with 🎲 icon (source guard)', () => {
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    // The nav config must have an entry with id='session' and icon '🎲'
    expect(src).toMatch(/id\s*:\s*['"]session['"]/);
    expect(src).toMatch(/icon\s*:\s*['"]🎲['"]/);
  });

  it('WorkspaceShell session nav entry is labeled so the Play-Mode is reachable via click', () => {
    // Guard: the nav button for 'session' exists in the sidebar config
    const src = readFileSync('src/ui/WorkspaceShell.tsx', 'utf-8');
    // The panel id and icon are declared together → panel is nav-accessible
    const hasSessionEntry = /\{[^}]*id\s*:\s*['"]session['"][^}]*icon\s*:\s*['"]🎲['"]\s*\}/.test(src)
      || /\{[^}]*icon\s*:\s*['"]🎲['"][^}]*id\s*:\s*['"]session['"]\s*\}/.test(src);
    expect(hasSessionEntry).toBe(true);
  });
});

// ── DM-Cockpit: Campaign/Session-Kontext im Kopf (D23) ───────────────────────
// NACHSCHÄRFUNG: DM sieht Campaign-Name + Session-Titel im Header des Play-Felds.

describe('#332 NACHSCHÄRFUNG — DM-Cockpit', () => {
  it('DM view shows campaign/session context in the header area', async () => {
    const raw = new DatabaseSync(':memory:');
    raw.exec(runtimeSchemaSql);
    raw.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s1','Drachennacht',datetime('now'))`).run();
    const db = makeAsyncDb(raw);

    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));

    // Session title or context visible somewhere in the DM view
    expect(document.body.textContent).toMatch(/Drachennacht|s1/i);
  });

  it('DM view exposes a way to reach Lobby (DM-Cockpit orchestration)', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));

    // Lobby-link/button must be reachable from DM play view
    const lobbyEl = screen.queryByRole('button', { name: /lobby/i })
      ?? screen.queryByRole('link', { name: /lobby/i })
      ?? screen.queryByTestId('dm-lobby');
    expect(lobbyEl).not.toBeNull();
  });

  it('player view does NOT show DM cockpit controls (D15)', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="player" playerId="p1" />);
    await waitFor(() => screen.getByRole('tab', { name: /map|karte/i }));

    expect(screen.queryByTestId('dm-cockpit')).toBeNull();
    expect(screen.queryByRole('button', { name: /lobby/i })).toBeNull();
  });
});

// ── #341 D27: SignalingPanel NICHT in LAN-Lobby gemountet ────────────────────
// RED: PlayModeView mountet SignalingPanel aktuell in der LAN-Lobby (falsch).
// Nach Fix: SignalingPanel nur in Stufe-3-Sicht; in LAN-Lobby nicht sichtbar.

describe('#341 D27 PlayModeView — SignalingPanel nicht in LAN-Lobby', () => {
  it('DM lobby does NOT render Antwort-Code / SignalingPanel content', async () => {
    const db = createDb();
    render(<PlayModeView database={db} sessionId="s1" role="dm" />);
    await waitFor(() => screen.getByTestId('dm-lobby'));
    fireEvent.click(screen.getByTestId('dm-lobby'));

    await waitFor(() => {
      // LobbyPanel or some lobby content should render
      const lobbyEl = document.body.textContent;
      expect(lobbyEl).toBeTruthy();
    });
    // SignalingPanel-owned text must NOT appear in LAN-lobby
    expect(screen.queryByText(/antwort.*code|schritt 2.*antwort|answer.*code/i)).toBeNull();
    expect(screen.queryByTestId('submit-answer-code')).toBeNull();
  });

  it('source guard: SignalingPanel JSX not rendered in LAN-Lobby branch of PlayModeView', () => {
    const src = readFileSync('src/ui/PlayModeView.tsx', 'utf-8');
    // After #341 fix: <SignalingPanel must not appear anywhere near the dm-lobby branch
    // The lobby and SignalingPanel are within ~525 chars in the bug state.
    // Guard: within 700 chars of "dm-lobby", no <SignalingPanel must appear.
    const lobbySectionMatch = src.match(/dm-lobby[\s\S]{0,700}/);
    if (lobbySectionMatch) {
      expect(lobbySectionMatch[0]).not.toMatch(/<SignalingPanel/);
    } else {
      // If no match at all, that means dm-lobby was removed — also wrong
      expect.fail('dm-lobby not found in PlayModeView source');
    }
  });
});
