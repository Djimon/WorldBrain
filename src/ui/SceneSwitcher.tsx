// M15-S15 (#286): scene list/switcher — create/rename/duplicate/delete/
// reorder audio_scenes; selecting a scene swaps the whole board (D7).
// Delete uses a rendered confirm dialog (AP-003 — never window.confirm()).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  createScene, deleteScene, duplicateScene, listScenes, renameScene, reorderScenes,
} from '../services/audio-service';
import type { AudioSceneRow } from '../services/audio-service';

export interface SceneSwitcherProps {
  database: DatabaseLike;
  activeSceneId: string | null;
  onSelectScene: (sceneId: string) => void;
  onScenesChanged?: () => void;
}

export function SceneSwitcher({ database, activeSceneId, onSelectScene, onScenesChanged }: SceneSwitcherProps) {
  const { t } = useTranslation('nav');
  const [scenes, setScenes] = useState<AudioSceneRow[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const reload = useCallback(() => {
    listScenes(database).then(setScenes).catch(console.error);
  }, [database]);

  useEffect(() => { reload(); }, [reload]);

  async function handleCreate() {
    const { id } = await createScene(database, { name: t('audioSceneNewName', 'Neue Szene') });
    reload();
    onScenesChanged?.();
    onSelectScene(id);
  }

  async function handleRenameCommit() {
    if (renamingId && renameValue.trim()) {
      await renameScene(database, renamingId, renameValue.trim());
      reload();
    }
    setRenamingId(null);
  }

  async function handleDuplicate(id: string, name: string) {
    const { id: newId } = await duplicateScene(database, id, `${name} (${t('audioSceneCopySuffix', 'Kopie')})`);
    reload();
    onScenesChanged?.();
    onSelectScene(newId);
  }

  async function handleConfirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (!id) return;
    await deleteScene(database, id);
    const remaining = scenes.filter((s) => s.id !== id);
    setScenes(remaining);
    onScenesChanged?.();
    if (activeSceneId === id && remaining[0]) onSelectScene(remaining[0].id);
    reload();
  }

  async function handleMove(id: string, direction: -1 | 1) {
    const idx = scenes.findIndex((s) => s.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= scenes.length) return;
    const next = [...scenes];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setScenes(next);
    await reorderScenes(database, next.map((s) => s.id));
    reload();
  }

  if (confirmDeleteId) {
    return (
      <div className="scene-switcher">
        <div role="dialog" aria-label={t('audioSceneConfirmDeleteTitle', 'Szene löschen?')} className="scene-switcher__confirm-dialog">
          <p>{t('audioSceneConfirmDeleteBody', 'Die Szene wird mit allen Kanälen und Clips gelöscht.')}</p>
          <div className="scene-switcher__confirm-actions">
            <button type="button" className="btn btn--primary" onClick={() => void handleConfirmDelete()}>
              {t('audioSceneConfirmDeleteAction', 'Löschen')}
            </button>
            <button type="button" className="btn" onClick={() => setConfirmDeleteId(null)}>
              {t('audioSceneCancel', 'Abbrechen')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="scene-switcher">
      <ul className="scene-switcher__list">
        {scenes.map((scene, i) => (
          <li key={scene.id} className="scene-switcher__item">
            {renamingId === scene.id ? (
              <>
                <input
                  value={renameValue}
                  aria-label={t('audioSceneRenameInput', 'Szenenname')}
                  onChange={(e) => setRenameValue(e.target.value)}
                />
                <button type="button" className="btn btn--primary" onClick={() => void handleRenameCommit()}>
                  {t('audioSceneRenameSave', 'Speichern')}
                </button>
                <button type="button" className="btn" onClick={() => setRenamingId(null)}>
                  {t('audioSceneCancel', 'Abbrechen')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="scene-switcher__select"
                  aria-pressed={activeSceneId === scene.id}
                  onClick={() => onSelectScene(scene.id)}
                >
                  {scene.name}
                </button>
                <button type="button" aria-label={t('audioSceneMoveUp', 'Nach oben')} disabled={i === 0} onClick={() => void handleMove(scene.id, -1)}>↑</button>
                <button type="button" aria-label={t('audioSceneMoveDown', 'Nach unten')} disabled={i === scenes.length - 1} onClick={() => void handleMove(scene.id, 1)}>↓</button>
                <button type="button" aria-label={t('audioSceneRename', 'Umbenennen')} onClick={() => { setRenamingId(scene.id); setRenameValue(scene.name); }}>✎</button>
                <button type="button" aria-label={t('audioSceneDuplicate', 'Duplizieren')} onClick={() => void handleDuplicate(scene.id, scene.name)}>⧉</button>
                <button type="button" aria-label={t('audioSceneDelete', 'Löschen')} onClick={() => setConfirmDeleteId(scene.id)}>🗑</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="btn" onClick={() => void handleCreate()}>
        {t('audioSceneCreate', '+ Neue Szene')}
      </button>
    </div>
  );
}
