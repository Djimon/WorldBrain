// M15-S05 / #307: Map-Ordnerbaum konsumiert NestedTree — dünner Adapter,
// keine eigene Baum-Logik. Löschen zeigt einen gerenderten Dialog statt eines
// blockierenden Browser-Dialogs (AP-003); Karten fallen auf folder_id = NULL
// zurück, sie werden nicht mitgelöscht.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  moveMap,
  moveFolder,
  setFolderColor,
  type MapFolderRow,
} from '../services/map-folder-service';
import { NestedTree, fromParentId } from './NestedTree';
import type { TreeNode } from './NestedTree';

export interface MapFolderTreeMap {
  id: string;
  title: string;
  folder_id: string | null;
}

export interface MapFolderTreeProps {
  database: DatabaseLike;
  maps: MapFolderTreeMap[];
  selectedMapId?: string | null;
  onSelectMap?: (mapId: string) => void;
  /** Compact header icon button, next to "Neuer Ordner" — matches the Pin panel's header chrome (#308). */
  onImportMap?: () => void;
  importing?: boolean;
  /** Called after a map's folder_id changes (drag, or a folder holding it gets deleted) — the
   *  `maps` prop is owned by the parent, so it must refetch for the tree to reflect the move. */
  onMapsChanged?: () => void;
}

export function MapFolderTree({ database, maps, selectedMapId, onSelectMap, onImportMap, importing, onMapsChanged }: MapFolderTreeProps) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<MapFolderRow[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function reload() {
    listFolders(database).then(setFolders).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, [database]);

  const { root, ungrouped, pathToId } = fromParentId(
    folders.map((f) => ({ id: f.id, parent_id: f.parent_id, label: f.name, color: f.color })),
    maps.map((m) => ({ id: m.id, folderId: m.folder_id, label: m.title })),
  );

  function handleFolderMove(oldPath: string, newPath: string) {
    const folderId = pathToId.get(oldPath);
    if (!folderId || newPath === oldPath) return;

    const oldName = oldPath.split('/').pop()!;
    const newName = newPath.split('/').pop()!;
    const oldParentPath = oldPath.includes('/') ? oldPath.slice(0, oldPath.lastIndexOf('/')) : '';
    const newParentPath = newPath.includes('/') ? newPath.slice(0, newPath.lastIndexOf('/')) : '';

    const tasks: Promise<unknown>[] = [];
    if (newName !== oldName) {
      tasks.push(renameFolder(database, folderId, newName));
    }
    if (newParentPath !== oldParentPath) {
      const newParentId = newParentPath ? pathToId.get(newParentPath) ?? undefined : null;
      if (newParentId !== undefined) {
        tasks.push(moveFolder(database, folderId, newParentId));
      }
    }
    if (tasks.length) Promise.all(tasks).then(reload).catch(console.error);
  }

  function handleItemMove(mapId: string, newPath: string) {
    const folderId = newPath ? pathToId.get(newPath) ?? null : null;
    void moveMap(database, mapId, folderId).then(() => onMapsChanged?.());
  }

  function handleCreateFolder(name: string) {
    void createFolder(database, { name, parent_id: null }).then(reload);
  }

  function handleConfirmDelete() {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    if (id) void deleteFolder(database, id).then(() => { reload(); onMapsChanged?.(); });
  }

  function handleDeleteFolder(node: TreeNode) {
    const id = pathToId.get(node.path);
    if (id) setConfirmDeleteId(id);
  }

  function handleFolderColorChange(path: string, color: string) {
    const id = pathToId.get(path);
    if (id) void setFolderColor(database, id, color || null).then(reload);
  }

  if (confirmDeleteId) {
    return (
      <div className="map-folder-tree">
        <div
          role="dialog"
          aria-label={t('mapFolderTree.confirmDeleteTitle', 'Ordner löschen?')}
          className="map-folder-tree__confirm-dialog"
        >
          <p className="map-folder-tree__confirm-text">{t('mapFolderTree.confirmDeleteBody', 'Der Ordner wird gelöscht. Enthaltene Karten verlieren nur ihre Ordnerzuordnung, sie werden nicht gelöscht.')}</p>
          <div className="map-folder-tree__confirm-actions">
            <button type="button" className="map-folder-tree__confirm-yes" onClick={handleConfirmDelete}>
              {t('mapFolderTree.confirmDeleteAction', 'Bestätigen')}
            </button>
            <button type="button" className="map-folder-tree__confirm-no" onClick={() => setConfirmDeleteId(null)}>
              {t('mapFolderTree.cancel', 'Abbrechen')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <NestedTree
      root={root}
      ungrouped={ungrouped}
      renderItem={(item) => <span className="map-folder-tree__map-title">{item.label}</span>}
      activeItemId={selectedMapId ?? null}
      onItemClick={(id) => onSelectMap?.(id)}
      onFolderMove={handleFolderMove}
      onItemMove={handleItemMove}
      onCreateFolder={handleCreateFolder}
      onDeleteFolder={handleDeleteFolder}
      onFolderColorChange={handleFolderColorChange}
      persistKey="map-folder-tree"
      header={
        <span className="u-row u-gap-1">
          {t('mapFolderTree.header', 'Karten')} ({maps.length})
          {onImportMap && (
            <button
              type="button"
              className="map-pin-tree__new-folder-btn"
              title={importing ? t('mapFolderTree.importing', 'Importiere…') : t('mapFolderTree.importMap', 'Karte importieren')}
              onClick={onImportMap}
              disabled={importing}
            >
              {importing ? '⏳' : '🗺️+'}
            </button>
          )}
        </span>
      }
    />
  );
}
