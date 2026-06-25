import { useState } from 'react';
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from '../services/snapshot-service';
import type { SnapshotEntry } from '../services/snapshot-service';

interface SnapshotManagerProps {
  projectId: string;
  onRestored: () => void;
  projectDir?: string;
  snapshotsDir?: string;
}

type DialogState =
  | { type: 'restore'; snapshot: SnapshotEntry }
  | { type: 'delete'; snapshot: SnapshotEntry }
  | null;

export function SnapshotManager({ projectId, onRestored, projectDir, snapshotsDir }: SnapshotManagerProps) {
  const snapshots = listSnapshots({ projectId, snapshotsDir });
  const [newName, setNewName] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  function handleCreate() {
    if (!newName.trim()) return;
    createSnapshot({ projectId, name: newName.trim(), projectDir, snapshotsDir });
    setNewName('');
  }

  function handleConfirmRestore() {
    if (dialog?.type !== 'restore') return;
    restoreSnapshot({ id: dialog.snapshot.id, projectDir, snapshotsDir });
    setDialog(null);
    onRestored();
  }

  function handleConfirmDelete() {
    if (dialog?.type !== 'delete') return;
    deleteSnapshot({ id: dialog.snapshot.id, snapshotsDir });
    setDialog(null);
  }

  function formatDate(iso: string): string {
    return iso.slice(0, 10);
  }

  function formatSize(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  }

  return (
    <div>
      <h2>Speicherstände</h2>

      <div>
        <label>
          Name
          <input
            type="text"
            aria-label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button onClick={handleCreate}>Speichern</button>
      </div>

      <ul>
        {snapshots.map((snap) => (
          <li key={snap.id}>
            <span>{snap.name}</span>
            <span>{formatDate(snap.createdAt)}</span>
            <span>{formatSize(snap.sizeBytes)}</span>
            <button aria-label="Wiederherstellen" onClick={() => setDialog({ type: 'restore', snapshot: snap })}>
              Wiederherstellen
            </button>
            <button aria-label="Löschen" onClick={() => setDialog({ type: 'delete', snapshot: snap })}>
              Löschen
            </button>
          </li>
        ))}
      </ul>

      {dialog?.type === 'restore' && (
        <div role="dialog" aria-modal="true">
          <p>Aktuelle Änderungen gehen verloren — fortfahren?</p>
          <button onClick={handleConfirmRestore}>Ja</button>
          <button onClick={() => setDialog(null)}>Abbrechen</button>
        </div>
      )}

      {dialog?.type === 'delete' && (
        <div role="dialog" aria-modal="true">
          <p>Speicherstand „{dialog.snapshot.name}" wirklich löschen?</p>
          <button onClick={handleConfirmDelete}>Ja</button>
          <button onClick={() => setDialog(null)}>Abbrechen</button>
        </div>
      )}
    </div>
  );
}
