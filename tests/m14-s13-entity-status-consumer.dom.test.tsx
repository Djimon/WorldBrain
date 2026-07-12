// M14-S13: Konsum — Entity-Status am Kalender-Tag
// See: https://github.com/Djimon/WorldBrain/issues/268
//
// Note: EntityStatusBadge is a new, focused component — the minimal visible
// derived-state consumer required by this story ("ein sichtbarer
// Konsument", EPIC-022 Decision 8). It takes {database, entityId, day} and
// projects entityStatusAt(database, entityId, day); wiring it into
// CalendarMonthView's active-day/window context is presentation placement,
// not new testable behavior — this file covers the consumer's actual
// derived-read/no-write contract directly.
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-008 (RTL): anchored queries.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EntityStatusBadge } from '../src/ui/EntityStatusBadge';

vi.mock('../src/services/world-state-projection', () => ({
  entityStatusAt: vi.fn(async (_db: unknown, entityId: string, day: number) => {
    if (entityId !== 'npc_1') return undefined;
    return day >= 10 ? 'dead' : 'alive';
  }),
}));

describe('M14-S13 entity status consumer (derived, at the active calendar day)', () => {
  describe('shows the status before the death day, and "dead" from the death day onward', () => {
    it('day=5 (< T=10) shows the prior status ("alive")', async () => {
      const database = { execute: vi.fn(), select: vi.fn() };
      render(<EntityStatusBadge database={database} entityId="npc_1" day={5} />);
      await waitFor(() => expect(screen.getByText(/alive/i)).toBeInTheDocument());
    });

    it('day=10 (== T) shows "dead"', async () => {
      const database = { execute: vi.fn(), select: vi.fn() };
      render(<EntityStatusBadge database={database} entityId="npc_1" day={10} />);
      await waitFor(() => expect(screen.getByText(/dead/i)).toBeInTheDocument());
    });
  });

  describe('read-only / projected — never writes to the database', () => {
    it('rendering at any day never calls database.execute', async () => {
      const database = { execute: vi.fn(), select: vi.fn() };
      render(<EntityStatusBadge database={database} entityId="npc_1" day={5} />);
      await waitFor(() => expect(screen.getByText(/alive/i)).toBeInTheDocument());
      expect(database.execute).not.toHaveBeenCalled();
    });
  });

  describe('a day change updates the display, not the database', () => {
    it('re-rendering with day=10 after day=5 flips the shown status without any write', async () => {
      const database = { execute: vi.fn(), select: vi.fn() };
      const { rerender } = render(<EntityStatusBadge database={database} entityId="npc_1" day={5} />);
      await waitFor(() => expect(screen.getByText(/alive/i)).toBeInTheDocument());

      rerender(<EntityStatusBadge database={database} entityId="npc_1" day={10} />);
      await waitFor(() => expect(screen.getByText(/dead/i)).toBeInTheDocument());
      expect(screen.queryByText(/alive/i)).not.toBeInTheDocument();
      expect(database.execute).not.toHaveBeenCalled();
    });
  });
});
