// M8-S09: Entity Session Notes
// See: https://github.com/Djimon/WorldBrain/issues/161

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-log-service', () => ({
  addLogEntry: vi.fn(),
}));

import { EntitySessionNotes } from '../src/ui/EntitySessionNotes';

const MOCK_ENTITY = { id: 'npc-1', name: 'Aldric the Merchant', type: 'npc' };

describe('M8-S09 entity session notes', () => {
  describe('session notes section', () => {
    it('renders "Session Notes" section that is collapsed by default', () => {
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" />);
      const section = screen.getByText(/session.?notes/i);
      expect(section).toBeInTheDocument();
      // collapsed: content not visible
      expect(screen.queryByRole('textbox', { name: /notiz|note/i })).not.toBeInTheDocument();
    });

    it('clicking session notes header expands the section', () => {
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      expect(screen.getByRole('textbox', { name: /notiz|note/i })).toBeInTheDocument();
    });
  });

  describe('session-scoped notes', () => {
    it('note input saves as session-scoped (not to base entity) by default', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      const mockAdd = addLogEntry as ReturnType<typeof vi.fn>;
      mockAdd.mockClear();
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Merchant is hiding something' } });
      fireEvent.blur(input);
      // Session-scoped: log entry but base entity NOT updated with world_change
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ world_change: false }));
    });
  });

  describe('"In Welt übernehmen" action', () => {
    it('renders "In Welt übernehmen" button when section is expanded', () => {
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      expect(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i })).toBeInTheDocument();
    });

    it('clicking "In Welt übernehmen" adds log entry with world_change: true', async () => {
      const { addLogEntry } = await import('../src/services/session-log-service');
      const mockAdd = addLogEntry as ReturnType<typeof vi.fn>;
      mockAdd.mockClear();
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" onApplyToWorld={vi.fn()} />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Now known to be a spy' } });
      fireEvent.click(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i }));
      expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ world_change: true }));
    });

    it('clicking "In Welt übernehmen" calls onApplyToWorld with entity id and note', () => {
      const onApply = vi.fn();
      render(<EntitySessionNotes entity={MOCK_ENTITY} sessionId="s1" onApplyToWorld={onApply} />);
      fireEvent.click(screen.getByText(/session.?notes/i));
      const input = screen.getByRole('textbox', { name: /notiz|note/i });
      fireEvent.change(input, { target: { value: 'Spy revealed' } });
      fireEvent.click(screen.getByRole('button', { name: /welt.*übernehmen|world.*adopt|apply/i }));
      expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ entityId: 'npc-1' }));
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('EntitySessionNotes.tsx does not use window.prompt, alert or confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/EntitySessionNotes.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
