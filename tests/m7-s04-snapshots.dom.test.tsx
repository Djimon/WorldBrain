// M7-S04: Benannte Speicherstände (Snapshots)
// See: https://github.com/Djimon/WorldBrain/issues/137

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/snapshot-service', () => ({
  listSnapshots: vi.fn(() => [
    { id: 'snap-1', name: 'Vor großem Umbau', createdAt: '2026-06-01T10:00:00Z', sizeBytes: 1024000 },
    { id: 'snap-2', name: 'Nach Session 5', createdAt: '2026-06-15T18:30:00Z', sizeBytes: 2048000 },
  ]),
  createSnapshot: vi.fn(() => ({ id: 'snap-new' })),
  restoreSnapshot: vi.fn(),
  deleteSnapshot: vi.fn(),
}));

import { SnapshotManager } from '../src/ui/SnapshotManager';

describe('M7-S04 snapshot manager', () => {
  describe('list display', () => {
    it('shows snapshot names', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getByText(/Vor großem Umbau/i)).toBeInTheDocument();
      expect(screen.getByText(/Nach Session 5/i)).toBeInTheDocument();
    });

    it('shows snapshot dates', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getByText(/2026-06-01|01\.06\.2026|Jun.*2026/i)).toBeInTheDocument();
    });

    it('shows snapshot size', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getByText(/1.*MB|1024.*KB|1\.0.*MB/i)).toBeInTheDocument();
    });
  });

  describe('create snapshot', () => {
    it('has name input for new snapshot', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getByRole('textbox', { name: /name/i })).toBeInTheDocument();
    });

    it('has create/save button', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getByRole('button', { name: /speichern|anlegen|create|save/i })).toBeInTheDocument();
    });

    it('name field is required — empty name does not call createSnapshot', async () => {
      const { createSnapshot } = await import('../src/services/snapshot-service');
      const mockCreate = createSnapshot as ReturnType<typeof vi.fn>;
      mockCreate.mockClear();
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: /speichern|anlegen|create|save/i }));
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe('restore', () => {
    it('each snapshot has a restore button', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getAllByRole('button', { name: /wiederherstellen|restore/i }).length).toBeGreaterThan(0);
    });

    it('clicking restore shows confirmation dialog with warning text', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      const restoreBtn = screen.getAllByRole('button', { name: /wiederherstellen|restore/i })[0];
      fireEvent.click(restoreBtn);
      expect(screen.getByText(/aktuelle änderungen gehen verloren|current changes.*lost/i)).toBeInTheDocument();
    });

    it('confirmation dialog has confirm and cancel buttons', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      fireEvent.click(screen.getAllByRole('button', { name: /wiederherstellen|restore/i })[0]);
      expect(screen.getByRole('button', { name: /ja|yes|fortfahren|confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /abbrechen|cancel/i })).toBeInTheDocument();
    });
  });

  describe('delete', () => {
    it('each snapshot has a delete button', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      expect(screen.getAllByRole('button', { name: /löschen|delete/i }).length).toBeGreaterThan(0);
    });

    it('clicking delete shows confirmation dialog', () => {
      render(<SnapshotManager projectId="proj-1" onRestored={vi.fn()} />);
      const deleteBtn = screen.getAllByRole('button', { name: /löschen|delete/i })[0];
      fireEvent.click(deleteBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('no prompt/alert/confirm', () => {
    it('does not use window.prompt, window.alert or window.confirm', async () => {
      const src = await import('fs').then(fs => fs.readFileSync('src/ui/SnapshotManager.tsx', 'utf-8'));
      expect(src).not.toMatch(/\bprompt\s*\(/);
      expect(src).not.toMatch(/\balert\s*\(/);
      expect(src).not.toMatch(/\bconfirm\s*\(/);
    });
  });
});
