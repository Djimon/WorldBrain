import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { listSnapshots, createSnapshot, restoreSnapshot, deleteSnapshot } from '../services/snapshot-service';
import type { SnapshotEntry } from '../services/snapshot-service';
import { Button, Field, ListRow, ListSurface, Panel } from './primitives';

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
    <div className="snapshot u-stack u-gap-4">
      {/* Create — name field + action on one row, action aligned to the input baseline. */}
      <div className="snapshot__create">
        <div className="u-grow">
          <Field
            label={t('snapshot.name')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
          />
        </div>
        <Button tone="accent" onClick={handleCreate} disabled={!newName.trim()}>
          {t('snapshot.create')}
        </Button>
      </div>

      {/* Saved states — one row each; name + meta on the left, actions on the right. */}
      {snapshots.length === 0 ? (
        <p className="snapshot__empty">{t('snapshot.empty')}</p>
      ) : (
        <ListSurface>
          {snapshots.map((snap) => (
            <ListRow as="div" key={snap.id} interactive={false} className="u-justify-between">
              <span className="snapshot__info">
                <span className="snapshot__name">{snap.name}</span>
                <span className="snapshot__sub">
                  <span>{formatDate(snap.createdAt)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatSize(snap.sizeBytes)}</span>
                </span>
              </span>
              <span className="snapshot__actions u-row u-gap-2">
                <Button
                  variant="outline"
                  size="compact"
                  aria-label={t('snapshot.restore')}
                  onClick={() => setDialog({ type: 'restore', snapshot: snap })}
                >
                  {t('snapshot.restore')}
                </Button>
                <Button
                  variant="outline"
                  tone="danger"
                  size="compact"
                  aria-label={t('delete', { ns: 'common' })}
                  onClick={() => setDialog({ type: 'delete', snapshot: snap })}
                >
                  {t('delete', { ns: 'common' })}
                </Button>
              </span>
            </ListRow>
          ))}
        </ListSurface>
      )}

      {/* Single confirm overlay for both restore and delete. */}
      {dialog !== null && (
        <div className="snapshot__overlay" role="dialog" aria-modal="true">
          <Panel className="snapshot__dialog u-stack u-gap-4">
            <p className="snapshot__dialog-text">
              {dialog.type === 'restore'
                ? t('snapshot.confirmRestore')
                : t('snapshot.confirmDelete', { name: dialog.snapshot.name })}
            </p>
            <div className="snapshot__dialog-actions">
              <Button variant="outline" onClick={() => setDialog(null)}>
                {t('cancel', { ns: 'common' })}
              </Button>
              <Button
                tone={dialog.type === 'delete' ? 'danger' : 'accent'}
                onClick={dialog.type === 'restore' ? handleConfirmRestore : handleConfirmDelete}
              >
                {t('yes', { ns: 'common' })}
              </Button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
