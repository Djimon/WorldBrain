// M10-S06: GM-Lobby & Approve-Management
// See: https://github.com/Djimon/WorldBrain/issues/200
//
// RED: LobbyPanel stub throws. Tests fail until implementer builds the lobby.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, d: string) => d ?? k }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import type { DatabaseLike } from '../src/services/entity-service';
import { LobbyPanel } from '../src/ui/LobbyPanel';

const runtimeSchemaSql = readFileSync('src/data/runtime/schema.sql', 'utf-8');

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> =>
      Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  // seed a session
  db.prepare(
    `INSERT INTO sessions (id, title, created_at) VALUES ('s1', 'Test-Runde', datetime('now'))`,
  ).run();
  db.prepare(
    `INSERT INTO players (id, display_name, created_at) VALUES ('p1', 'Aragorn', datetime('now')), ('p2', 'Legolas', datetime('now'))`,
  ).run();
  // D24: status column (not invite_status)
  db.prepare(
    `INSERT INTO session_players (session_id, player_id, token_hash, status, joined_at)
     VALUES ('s1','p1','hash1','active',datetime('now')), ('s1','p2','hash2','active',datetime('now'))`,
  ).run();
  return { db, asyncDb: makeAsyncDb(db) };
}

beforeEach(() => vi.clearAllMocks());

// ── Lobby renders ─────────────────────────────────────────────────────────────

describe('#200 LobbyPanel — renders', () => {
  it('renders a connected-players section', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() =>
      expect(screen.getByText(/verbunden|spieler/i)).toBeInTheDocument(),
    );
  });

  it('shows active players by display name', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() =>
      expect(screen.getByText('Aragorn')).toBeInTheDocument(),
    );
    expect(screen.getByText('Legolas')).toBeInTheDocument();
  });
});

// ── Kick ─────────────────────────────────────────────────────────────────────

describe('#200 LobbyPanel — Kick', () => {
  it('active players have a Kick button', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.getByText('Legolas'));
    const row = screen.getByText('Legolas').closest('[data-player-id="p2"]')
      ?? screen.getByText('Legolas').closest('li, tr, [role="listitem"]');
    expect(within(row as HTMLElement).getByRole('button', { name: /kick|entfernen/i })).toBeInTheDocument();
  });

  it('clicking Kick removes the player from the list', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.getByText('Legolas'));
    const row = screen.getByText('Legolas').closest('[data-player-id="p2"]')
      ?? screen.getByText('Legolas').closest('li, tr, [role="listitem"]');
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: /kick|entfernen/i }));
    await waitFor(() => expect(screen.queryByText('Legolas')).toBeNull());
  });
});

// ── Invite code display + regenerate ─────────────────────────────────────────

describe('#200 LobbyPanel — Einladungscode', () => {
  it('renders the current invite code', async () => {
    const { db, asyncDb } = createDb();
    // seed an invite code
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('ABCD1234','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() =>
      expect(screen.getByDisplayValue('ABCD1234')).toBeInTheDocument(),
    );
  });

  it('renders a "regenerate code" button', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /neu.*code|code.*neu|regenerier/i })).toBeInTheDocument(),
    );
  });

  it('clicking regenerate shows a new code (different from old)', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code, session_id, created_at, is_active) VALUES ('OLDCODE1','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.getByDisplayValue('OLDCODE1'));
    fireEvent.click(screen.getByRole('button', { name: /neu.*code|code.*neu|regenerier/i }));
    await waitFor(() =>
      expect(screen.queryByDisplayValue('OLDCODE1')).toBeNull(),
    );
  });
});

// ── Start/Stop hosting ────────────────────────────────────────────────────────

describe('#200 LobbyPanel — Hosting-Schalter', () => {
  it('renders a "Hosting starten" button when not hosting', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" onStartHosting={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /hosting.*start|server.*start|live schalten/i })).toBeInTheDocument(),
    );
  });

  it('clicking "Hosting starten" calls onStartHosting', async () => {
    const onStartHosting = vi.fn();
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" onStartHosting={onStartHosting} />);
    await waitFor(() => screen.getByRole('button', { name: /hosting.*start|server.*start|live schalten/i }));
    fireEvent.click(screen.getByRole('button', { name: /hosting.*start|server.*start|live schalten/i }));
    expect(onStartHosting).toHaveBeenCalled();
  });

  it('renders a "Hosting stoppen" button when hosting', async () => {
    const { asyncDb } = createDb();
    render(<LobbyPanel database={asyncDb} sessionId="s1" onStopHosting={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /hosting.*stop|server.*stop|offline/i })).toBeInTheDocument(),
    );
  });
});

// ── AP-003 ────────────────────────────────────────────────────────────────────

describe('#200 LobbyPanel — AP-003', () => {
  it('source has no window.alert / confirm / prompt calls', () => {
    const src = readFileSync('src/ui/LobbyPanel.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(alert|confirm|prompt)\s*\(/);
  });
});

// ── #340 D24: Auto-Join — Lobby zeigt NUR aktive Spieler + Kick ──────────────
// RED: LobbyPanel rendert noch pending-Sektion + Approve/Reject-Buttons.
// Nach Fix: nur status='active'-Spieler + Kick sichtbar; kein Approve/Reject.

function createDbD24() {
  // NEW schema: session_players.status (not invite_status)
  // Fails at INSERT until schema.sql is updated → RED
  const db = new DatabaseSync(':memory:');
  db.exec(runtimeSchemaSql);
  db.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s2','D24-Runde',datetime('now'))`).run();
  db.prepare(`INSERT INTO players (id,display_name,created_at) VALUES ('pa','Aragorn',datetime('now')),('pb','Legolas',datetime('now'))`).run();
  // Uses NEW column 'status' (not 'invite_status') → RED until schema updated
  db.prepare(
    `INSERT INTO session_players (session_id,player_id,token_hash,status,joined_at)
     VALUES ('s2','pa','ha','active',datetime('now')),('s2','pb','hb','active',datetime('now'))`,
  ).run();
  return makeAsyncDb(db);
}

describe('#340 D24 LobbyPanel — kein Approve-Gate, nur Kick', () => {
  it('LobbyPanel renders NO approve/reject buttons (D24: auto-join)', async () => {
    const db = createDbD24();
    render(<LobbyPanel database={db} sessionId="s2" />);
    await waitFor(() => screen.getByText('Aragorn'));
    expect(screen.queryByRole('button', { name: /bestätigen|approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ablehnen|reject/i })).toBeNull();
  });

  it('LobbyPanel renders NO pending-section (D24)', async () => {
    const db = createDbD24();
    render(<LobbyPanel database={db} sessionId="s2" />);
    await waitFor(() => screen.getByText('Aragorn'));
    expect(screen.queryByText(/ausstehend|pending|anfragen/i)).toBeNull();
    expect(screen.queryByTestId('lobby-pending-section')).toBeNull();
  });

  it('LobbyPanel renders a Kick button for each active player', async () => {
    const db = createDbD24();
    render(<LobbyPanel database={db} sessionId="s2" />);
    await waitFor(() => screen.getByText('Aragorn'));
    const kickBtns = screen.getAllByRole('button', { name: /kick|rauswerfen/i });
    expect(kickBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('LobbyPanel only loads status=active players (not kicked)', async () => {
    // Seed: one active, one kicked — only active should appear
    const db = new DatabaseSync(':memory:');
    db.exec(runtimeSchemaSql);
    db.prepare(`INSERT INTO sessions (id,title,created_at) VALUES ('s3','Kick-Runde',datetime('now'))`).run();
    db.prepare(`INSERT INTO players (id,display_name,created_at) VALUES ('px','Aktiver',datetime('now')),('py','Gekickt',datetime('now'))`).run();
    db.prepare(
      `INSERT INTO session_players (session_id,player_id,token_hash,status,joined_at)
       VALUES ('s3','px','hx','active',datetime('now')),('s3','py','hy','kicked',datetime('now'))`,
    ).run();
    const asyncDb = makeAsyncDb(db);
    render(<LobbyPanel database={asyncDb} sessionId="s3" />);
    await waitFor(() => screen.getByText('Aktiver'));
    expect(screen.queryByText('Gekickt')).toBeNull();
  });
});

// ── #341 D27: Copy-Feld + kein Signaling-Leak ────────────────────────────────
// RED: Code steht als nacktes <span>; kein readonly Input; kein Copy-Button.
// Clipboard-write wird nicht aufgerufen.

describe('#341 D27 LobbyPanel — kopierbares Code-Feld', () => {
  it('renders a readonly input containing the invite code', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code,session_id,created_at,is_active) VALUES ('COPYTEST','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => {
      const input = screen.queryByDisplayValue('COPYTEST') as HTMLInputElement | null;
      expect(input).not.toBeNull();
      expect(input?.readOnly).toBe(true);
    });
  });

  it('renders a copy button next to the invite code', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code,session_id,created_at,is_active) VALUES ('COPYBTN1','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.queryByDisplayValue('COPYBTN1'));
    expect(screen.getByRole('button', { name: /kopier|copy/i })).toBeInTheDocument();
  });

  it('clicking the copy button writes the code to clipboard', async () => {
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: writeTextSpy } });

    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code,session_id,created_at,is_active) VALUES ('CLIPBRD1','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.queryByDisplayValue('CLIPBRD1'));
    fireEvent.click(screen.getByRole('button', { name: /kopier|copy/i }));
    await waitFor(() => expect(writeTextSpy).toHaveBeenCalledWith('CLIPBRD1'));
  });

  it('renders an invitation link field (readonly, server-url + code combined)', async () => {
    const { db, asyncDb } = createDb();
    db.prepare(
      `INSERT INTO invite_codes (code,session_id,created_at,is_active) VALUES ('LINKTEST','s1',datetime('now'),1)`,
    ).run();
    render(<LobbyPanel database={asyncDb} sessionId="s1" />);
    await waitFor(() => screen.queryByDisplayValue('LINKTEST'));
    // Link-field contains the code and a URL fragment
    const inputs = document.querySelectorAll('input[readonly]');
    const linkField = Array.from(inputs).find((el) =>
      el.getAttribute('value')?.includes('LINKTEST') && el.getAttribute('value')?.includes('://'),
    );
    expect(linkField).not.toBeNull();
  });
});
