import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('session');
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([]);
  const [newName, setNewName] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  function reload() {
    listSnapshots({ projectId, snapshotsDir }).then(setSnapshots).catch(() => setSnapshots([]));
  }

  useEffect(() => { reload(); }, [projectId, snapshotsDir]);

  function handleCreate() {
    if (!newName.trim()) return;
    createSnapshot({ projectId, name: newName.trim(), projectDir, snapshotsDir })
      .then(() => { setNewName(''); reload(); })
      .catch(() => { /* ignore */ });
  }

  function handleConfirmRestore() {
    if (dialog?.type !== 'restore') return;
    restoreSnapshot({ id: dialog.snapshot.id, projectDir, snapshotsDir })
      .then(() => { setDialog(null); onRestored(); })
      .catch(() => setDialog(null));
  }

  function handleConfirmDelete() {
    if (dialog?.type !== 'delete') return;
    deleteSnapshot({ id: dialog.snapshot.id, snapshotsDir })
      .then(() => { setDialog(null); reload(); })
      .catch(() => setDialog(null));
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
      <h2>{t('snapshot.title')}</h2>

      <div>
        <label>
          {t('snapshot.name')}
          <input
            type="text"
            aria-label={t('snapshot.name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </label>
        <button onClick={handleCreate}>{t('snapshot.create')}</button>
      </div>

      <ul>
        {snapshots.map((snap) => (
          <li key={snap.id}>
            <span>{snap.name}</span>
            <span>{formatDate(snap.createdAt)}</span>
            <span>{formatSize(snap.sizeBytes)}</span>
            <button aria-label={t('snapshot.restore')} onClick={() => setDialog({ type: 'restore', snapshot: snap })}>
              {t('snapshot.restore')}
            </button>
            <button aria-label={t('snapshot.delete')} onClick={() => setDialog({ type: 'delete', snapshot: snap })}>
              {t('snapshot.delete')}
            </button>
          </li>
        ))}
      </ul>

      {dialog?.type === 'restore' && (
        <div role="dialog" aria-modal="true">
          <p>{t('snapshot.confirmRestore')}</p>
          <button onClick={handleConfirmRestore}>{t('yes', { ns: 'common' })}</button>
          <button onClick={() => setDialog(null)}>{t('cancel', { ns: 'common' })}</button>
        </div>
      )}

      {dialog?.type === 'delete' && (
        <div role="dialog" aria-modal="true">
          <p>{t('snapshot.confirmDelete', { name: dialog.snapshot.name })}</p>
          <button onClick={handleConfirmDelete}>{t('yes', { ns: 'common' })}</button>
          <button onClick={() => setDialog(null)}>{t('cancel', { ns: 'common' })}</button>
        </div>
      )}
    </div>
  );
}
