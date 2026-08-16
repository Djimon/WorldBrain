// M15-S15 (#286): scene list/switcher — create/rename/duplicate/delete/
// reorder audio_scenes; selecting a scene swaps the whole board (D7).
// Delete uses a rendered confirm dialog (AP-003 — never window.confirm()).
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { DatabaseLike } from '../services/entity-service';
import {
  createScene, deleteScene, duplicateScene, listScenes, renameScene, reorderScenes,
} from '../services/audio-service';
import type { AudioSceneRow } from '../services/audio-service';
import { exportScenesToJson, importAudioBoardFromJson } from '../services/audio-export-import-service';
import { Button } from './primitives';

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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set());
  const [importError, setImportError] = useState<string | null>(null);

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

  function handleOpenExportDialog() {
    setSelectedSceneIds(new Set());
    setExportDialogOpen(true);
  }

  function toggleSceneSelected(id: string) {
    setSelectedSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleExportConfirm() {
    const payload = await exportScenesToJson(database, Array.from(selectedSceneIds));
    const path = await save({ filters: [{ name: 'JSON', extensions: ['json'] }], defaultPath: 'soundboard-export.json' });
    if (!path) return;
    await writeTextFile(path, JSON.stringify(payload, null, 2));
    setExportDialogOpen(false);
  }

  async function handleImportClick() {
    const path = await open({ filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path || Array.isArray(path)) return;
    setImportError(null);
    try {
      const text = await readTextFile(path);
      const parsed = JSON.parse(text);
      await importAudioBoardFromJson(database, parsed);
      reload();
      onScenesChanged?.();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : t('audioImportError', 'Import fehlgeschlagen — ungültige Datei.'));
    }
  }

  if (confirmDeleteId) {
    return (
      <div className="scene-switcher">
        <div role="dialog" aria-label={t('audioSceneConfirmDeleteTitle', 'Szene löschen?')} className="scene-switcher__confirm-dialog">
          <p>{t('audioSceneConfirmDeleteBody', 'Die Szene wird mit allen Kanälen und Clips gelöscht.')}</p>
          <div className="scene-switcher__confirm-actions">
            <Button tone="accent" onClick={() => void handleConfirmDelete()}>
              {t('audioSceneConfirmDeleteAction', 'Löschen')}
            </Button>
            <Button onClick={() => setConfirmDeleteId(null)}>
              {t('audioSceneCancel', 'Abbrechen')}
            </Button>
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
                <Button tone="accent" onClick={() => void handleRenameCommit()}>
                  {t('audioSceneRenameSave', 'Speichern')}
                </Button>
                <Button onClick={() => setRenamingId(null)}>
                  {t('audioSceneCancel', 'Abbrechen')}
                </Button>
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
                <button type="button" aria-label={t('audioSceneMoveUp', 'Nach oben')} title={t('audioSceneMoveUp', 'Nach oben')} disabled={i === 0} onClick={() => void handleMove(scene.id, -1)}>↑</button>
                <button type="button" aria-label={t('audioSceneMoveDown', 'Nach unten')} title={t('audioSceneMoveDown', 'Nach unten')} disabled={i === scenes.length - 1} onClick={() => void handleMove(scene.id, 1)}>↓</button>
                <button type="button" aria-label={t('audioSceneRename', 'Umbenennen')} title={t('audioSceneRename', 'Umbenennen')} onClick={() => { setRenamingId(scene.id); setRenameValue(scene.name); }}>✎</button>
                <button type="button" aria-label={t('audioSceneDuplicate', 'Duplizieren')} title={t('audioSceneDuplicate', 'Duplizieren')} onClick={() => void handleDuplicate(scene.id, scene.name)}>⧉</button>
                <button type="button" aria-label={t('audioSceneDelete', 'Löschen')} title={t('audioSceneDelete', 'Löschen')} onClick={() => setConfirmDeleteId(scene.id)}>🗑</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <div className="scene-switcher__actions">
        <Button onClick={() => void handleCreate()}>
          {t('audioSceneCreate', '+ Neue Szene')}
        </Button>
        <Button tone="danger" onClick={handleOpenExportDialog}>
          {t('audioExport', 'Export')}
        </Button>
        <Button onClick={() => void handleImportClick()}>
          {t('audioImport', 'Import')}
        </Button>
      </div>
      {importError && (
        <div role="alert" className="scene-switcher__import-error">{importError}</div>
      )}
      {exportDialogOpen && (
        <div role="dialog" aria-label={t('audioExportDialogTitle', 'Szenen exportieren')} className="scene-switcher__export-dialog">
          <h2 className="scene-switcher__export-dialog-title">
            {t('audioExportDialogHeading', 'Wähle zu exportierende Szenen')}
          </h2>
          <div className="scene-switcher__export-select-actions">
            <Button onClick={() => setSelectedSceneIds(new Set(scenes.map((s) => s.id)))}>
              {t('audioExportSelectAll', 'Alle auswählen')}
            </Button>
            <Button onClick={() => setSelectedSceneIds(new Set())}>
              {t('audioExportSelectNone', 'Alle abwählen')}
            </Button>
          </div>
          <ul>
            {scenes.map((scene) => (
              <li key={scene.id}>
                <input
                  type="checkbox"
                  aria-label={scene.name}
                  checked={selectedSceneIds.has(scene.id)}
                  onChange={() => toggleSceneSelected(scene.id)}
                />
                {' '}{scene.name}
              </li>
            ))}
          </ul>
          <div className="scene-switcher__export-actions">
            <Button onClick={() => setExportDialogOpen(false)}>
              {t('audioSceneCancel', 'Abbrechen')}
            </Button>
            <Button tone="danger" onClick={() => void handleExportConfirm()}>
              {t('audioExport', 'Export')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
