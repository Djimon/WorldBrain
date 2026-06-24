// M4-S07: Capture inbox — quick in-session notes with type, status, entity links.
// See: https://github.com/Djimon/WorldBrain/issues/55

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CaptureInbox } from '../src/ui/CaptureInbox';

vi.mock('../src/services/capture-service', () => ({
  createCapture: vi.fn(() => ({ id: 'cap-1' })),
  listCaptures: vi.fn(() => [
    { id: 'cap-1', type: 'new_npc', raw_text: 'Mysterious merchant appeared.', status: 'needs_processing', links: [] },
    { id: 'cap-2', type: 'decision', raw_text: 'Party chose the northern road.', status: 'processed', links: ['char-ada'] },
    { id: 'cap-3', type: 'open_question', raw_text: 'Who is the masked figure?', status: 'needs_processing', links: [] },
  ]),
  updateCaptureStatus: vi.fn(),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn(() => [
    { id: 'char-ada', type: 'Character', title: 'Ada Thorn', summary: 'Archivist.', aliases: [] },
  ]),
}));

const mockDb = {};

describe('M4-S07 capture inbox', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<CaptureInbox sessionId="s1" database={mockDb as never} />)).not.toThrow();
    });

    it('displays existing captures', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      expect(screen.getByText('Mysterious merchant appeared.')).toBeInTheDocument();
      expect(screen.getByText('Party chose the northern road.')).toBeInTheDocument();
    });

    it('shows capture type labels', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      expect(screen.getByText(/new.?npc|new npc/i)).toBeInTheDocument();
    });

    it('shows status on each capture', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      expect(screen.getByText(/needs.?processing|needs processing/i)).toBeInTheDocument();
    });
  });

  describe('creating a capture', () => {
    it('renders a quick-capture input or button', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const input = screen.queryByRole('textbox', { name: /capture|note|quick/i })
        ?? screen.queryByRole('button', { name: /capture|add note|new capture/i });
      expect(input).toBeInTheDocument();
    });

    it('creates a capture in ≤2 interactions — type text and submit', async () => {
      const { createCapture } = await import('../src/services/capture-service');
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'A new clue.' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      expect(createCapture).toHaveBeenCalled();
    });

    it('capture type can be selected before submitting', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const typeSelect = screen.queryByRole('combobox', { name: /type|capture type/i });
      expect(typeSelect).toBeInTheDocument();
    });

    it('all 7 capture types are available as options', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const typeSelect = screen.queryByRole('combobox', { name: /type|capture type/i });
      if (typeSelect) {
        const options = Array.from(typeSelect.querySelectorAll('option')).map(o => o.value);
        const expected = ['new_npc', 'new_location', 'decision', 'open_question', 'improvised_lore', 'relation_hint', 'rule_ruling'];
        for (const type of expected) {
          expect(options).toContain(type);
        }
      }
    });
  });

  describe('entity link type-ahead', () => {
    it('renders a links field for entity references', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const linksInput = screen.queryByRole('searchbox', { name: /link|entity/i })
        ?? screen.queryByPlaceholderText(/link.*entity|entity.*link/i);
      // Links field may appear only after opening the add form
      const addBtn = screen.queryByRole('button', { name: /add|capture|new/i });
      if (addBtn) fireEvent.click(addBtn);
      const searchbox = screen.queryByRole('searchbox');
      expect(searchbox || linksInput).toBeTruthy();
    });
  });

  describe('status transitions', () => {
    it('needs_processing captures show a "Mark processed" or "Dismiss" control', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const control = screen.queryByRole('button', { name: /processed|dismiss|done/i });
      expect(control).toBeInTheDocument();
    });

    it('clicking Mark processed calls updateCaptureStatus', async () => {
      const { updateCaptureStatus } = await import('../src/services/capture-service');
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      fireEvent.click(screen.getByRole('button', { name: /processed|done/i }));
      expect(updateCaptureStatus).toHaveBeenCalled();
    });
  });

  describe('filtering', () => {
    it('can filter captures by status', () => {
      render(<CaptureInbox sessionId="s1" database={mockDb as never} />);
      const filter = screen.queryByRole('combobox', { name: /status|filter/i })
        ?? screen.queryByRole('button', { name: /pending|filter/i });
      expect(filter).toBeInTheDocument();
    });
  });
});

// Bug #119: listCaptures must not throw on malformed links_json — guards the inbox from being
//           permanently broken by a corrupt or migrated row.
describe('issue #119: listCaptures resilience against malformed links_json', () => {
  async function makeDb() {
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE capture_notes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      raw_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'needs_processing',
      links_json TEXT,
      created_at TEXT NOT NULL
    )`);
    return db;
  }

  it('listCaptures does not throw when links_json is an empty string', async () => {
    const { listCaptures } = await vi.importActual<typeof import('../src/services/capture-service')>('../src/services/capture-service');
    const db = await makeDb();
    db.prepare(
      `INSERT INTO capture_notes (id, session_id, type, raw_text, status, links_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('cap-corrupt', 's1', 'decision', 'Some text.', 'needs_processing', '', '2026-06-24T00:00:00.000Z');
    expect(() => listCaptures(db, 's1')).not.toThrow();
    db.close();
  });

  it('listCaptures returns [] for links when links_json is malformed', async () => {
    const { listCaptures } = await vi.importActual<typeof import('../src/services/capture-service')>('../src/services/capture-service');
    const db = await makeDb();
    db.prepare(
      `INSERT INTO capture_notes (id, session_id, type, raw_text, status, links_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('cap-corrupt', 's1', 'decision', 'Some text.', 'needs_processing', '{broken json', '2026-06-24T00:00:00.000Z');
    const captures = listCaptures(db, 's1');
    expect(Array.isArray(captures)).toBe(true);
    expect(captures[0].links).toEqual([]);
    db.close();
  });

  it('listCaptures does not throw when links_json is NULL', async () => {
    const { listCaptures } = await vi.importActual<typeof import('../src/services/capture-service')>('../src/services/capture-service');
    const db = await makeDb();
    db.prepare(
      `INSERT INTO capture_notes (id, session_id, type, raw_text, status, links_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run('cap-null', 's1', 'open_question', 'Some text.', 'needs_processing', null, '2026-06-24T00:00:00.000Z');
    expect(() => listCaptures(db, 's1')).not.toThrow();
    db.close();
  });
});
