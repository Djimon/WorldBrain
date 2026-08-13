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
