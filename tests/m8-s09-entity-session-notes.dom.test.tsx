// M8-S09: Entity Session Notes
// See: https://github.com/Djimon/WorldBrain/issues/161

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  listLogEntries: vi.fn(async () => []),
  addLogEntry: vi.fn(async () => undefined),
}));

import { EntitySessionNotes } from '../src/ui/EntitySessionNotes';
import { addLogEntry } from '../src/services/session-log-service';

const mockAddLogEntry = addLogEntry as ReturnType<typeof vi.fn>;

const mockDb = {
  execute: vi.fn().mockResolvedValue(undefined),
  select: vi.fn().mockResolvedValue([]),
};

const MOCK_ENTITY = { id: 'npc-1', name: 'Aldric the Merchant', type: 'npc' };

describe('M8-S09 entity session notes', () => {
  describe('session notes section', () => {
    it('renders "Session Notes" section that is collapsed by default', () => {
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" />);
      const section = screen.getByText(/session.?notes/i);
      expect(section).toBeInTheDocument();
      // collapsed: content not visible
      expect(screen.queryByRole('textbox', { name: /notiz|note/i })).not.toBeInTheDocument();
    });

    it('clicking session notes header expands the section', () => {
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      expect(screen.getByRole('textbox', { name: /notiz|note/i })).toBeInTheDocument();
    });
  });

  describe('session-scoped notes', () => {
    it('note input saves as session-scoped (not to base entity) by default', async () => {
      mockAddLogEntry.mockClear();
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Merchant is hiding something' } });
      fireEvent.blur(input);
      // Session-scoped: log entry but base entity NOT updated with world_change
      await waitFor(() => expect(mockAddLogEntry).toHaveBeenCalledWith(expect.objectContaining({ world_change: false })));
    });
  });

  describe('"In Welt übernehmen" action', () => {
    it('renders "In Welt übernehmen" button when section is expanded', () => {
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      expect(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i })).toBeInTheDocument();
    });

    it('clicking "In Welt übernehmen" adds log entry with world_change: true', async () => {
      mockAddLogEntry.mockClear();
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" onApplyToWorld={vi.fn()} />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Now known to be a spy' } });
      fireEvent.click(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i }));
      await waitFor(() => expect(mockAddLogEntry).toHaveBeenCalledWith(expect.objectContaining({ world_change: true })));
    });

    it('clicking "In Welt übernehmen" calls onApplyToWorld with entity id and note', async () => {
      const onApply = vi.fn();
      render(<EntitySessionNotes database={mockDb as never} entity={MOCK_ENTITY} sessionId="s1" onApplyToWorld={onApply} />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Spy revealed' } });
      fireEvent.click(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i }));
      await waitFor(() => expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'npc-1' })));
    });
  });

  describe('database prop convention (AP-001)', () => {
    it('EntitySessionNotes accepts DatabaseLike-shaped object without as-never cast', () => {
      const db = { execute: vi.fn().mockResolvedValue(undefined), select: vi.fn().mockResolvedValue([]) };
      expect(() => render(<EntitySessionNotes database={db} entity={MOCK_ENTITY} sessionId="s1" />)).not.toThrow();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('EntitySessionNotes.tsx does not use window.prompt, alert or confirm', () => {
      const src = readFileSync('src/ui/EntitySessionNotes.tsx', 'utf-8');
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
