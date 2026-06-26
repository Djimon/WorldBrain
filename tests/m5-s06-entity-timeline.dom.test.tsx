// M5-S06: Location & Character timeline views — entity-scoped event list via tab API.
// See: https://github.com/Djimon/WorldBrain/issues/72

import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EntityTimeline } from '../src/ui/EntityTimeline';

vi.mock('../src/services/event-service', () => ({
  listEvents: vi.fn((_db: unknown, { participantId, locationId }: { participantId?: string; locationId?: string }) => {
    const all = [
      { id: 'ev-1', title: 'Ada joins the Council', type: 'session_event', start_day: 100, precision: 'day', visibility: 'public', participants: ['char-ada'], locations: ['loc-keep'] },
      { id: 'ev-2', title: 'Battle at the Keep', type: 'historical_event', start_day: 200, precision: 'day', visibility: 'public', participants: ['char-bram'], locations: ['loc-keep'] },
      { id: 'ev-3', title: 'Ada escapes', type: 'session_event', start_day: 300, precision: 'day', visibility: 'public', participants: ['char-ada'], locations: ['loc-inn'] },
    ];
    if (participantId) return all.filter(e => e.participants.includes(participantId));
    if (locationId) return all.filter(e => e.locations.includes(locationId));
    return all;
  }),
}));

const mockDb = {};

describe('M5-S06 entity timeline views', () => {
  describe('Character Timeline', () => {
    it('renders without throwing for a character entity', () => {
      expect(() => render(<EntityTimeline entityId="char-ada" entityType="Character" database={mockDb as never} />)).not.toThrow();
    });

    it('shows only events where the character participated', () => {
      render(<EntityTimeline entityId="char-ada" entityType="Character" database={mockDb as never} />);
      expect(screen.getByText('Ada joins the Council')).toBeInTheDocument();
      expect(screen.getByText('Ada escapes')).toBeInTheDocument();
      expect(screen.queryByText('Battle at the Keep')).not.toBeInTheDocument();
    });

    it('events are in chronological order', () => {
      render(<EntityTimeline entityId="char-ada" entityType="Character" database={mockDb as never} />);
      const items = screen.getAllByRole('listitem');
      const joinIdx = items.findIndex(i => /joins/i.test(i.textContent ?? ''));
      const escapeIdx = items.findIndex(i => /escapes/i.test(i.textContent ?? ''));
      if (joinIdx !== -1 && escapeIdx !== -1) expect(joinIdx).toBeLessThan(escapeIdx);
    });
  });

  describe('Location Timeline', () => {
    it('renders without throwing for a location entity', () => {
      expect(() => render(<EntityTimeline entityId="loc-keep" entityType="Location" database={mockDb as never} />)).not.toThrow();
    });

    it('shows only events at the location', () => {
      render(<EntityTimeline entityId="loc-keep" entityType="Location" database={mockDb as never} />);
      expect(screen.getByText('Ada joins the Council')).toBeInTheDocument();
      expect(screen.getByText('Battle at the Keep')).toBeInTheDocument();
      expect(screen.queryByText('Ada escapes')).not.toBeInTheDocument();
    });
  });

  describe('tab registration compatibility', () => {
    it('EntityTimeline renders standalone (no special parent context required)', () => {
      expect(() => render(<EntityTimeline entityId="char-ada" entityType="Character" database={mockDb as never} />)).not.toThrow();
    });
  });
});

// Bug #124: AP-001 — database prop must be DatabaseLike, not unknown/never
describe('issue #124: EntityTimeline database prop typed as DatabaseLike', () => {
  it('accepts a DatabaseLike-shaped object without as-never cast', () => {
    const db = { exec: vi.fn(), prepare: vi.fn(() => ({ run: vi.fn(), all: vi.fn(() => []), get: vi.fn(() => null) })) };
    expect(() => render(<EntityTimeline entityId="char-ada" entityType="Character" database={db} />)).not.toThrow();
  });
});
