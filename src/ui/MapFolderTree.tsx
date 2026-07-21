// M15-S05: Map-Ordnerbaum — verschachtelte Folders für Maps (#277)
// Reuses map-folder-service.ts — no new persistence.
//
// Assumption (undocumented in AC): alongside the pointer-drag +
// data-drop-path/elementFromPoint pattern named in the AC (PinTree's, which
// relies on document.elementFromPoint — unavailable in jsdom, no test
// precedent anywhere in this repo), this component also exposes an
// accessible "verschieben nach"/"ordner verschieben nach" select per row.
// That's the primary testable affordance here — same reasoning as M15-S02's
// move-up/move-down buttons alongside LayerPanel's drag requirement. Drag
// is an additional Implementation Agent affordance layered on top, not a
// second code path.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import {
  listFolders, createFolder, renameFolder, deleteFolder, moveMap, moveFolder,
  type MapFolderRow,
} from '../services/map-folder-service';

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
}

type TreeRow =
  | { type: 'folder'; folder: MapFolderRow; depth: number }
  | { type: 'map'; map: MapFolderTreeMap; depth: number };

// Flat, depth-annotated row list (indentation via CSS, not DOM nesting) —
// so each row's own controls are the ONLY controls within that row's <li>,
// with no descendant rows to collide with (RTL within() matches any
// descendant, so nesting child folders' <li> inside a parent <li> would
// make a parent row's query also match every descendant row's buttons).
function flattenTree(folders: MapFolderRow[], maps: MapFolderTreeMap[]): TreeRow[] {
  const childFolders = new Map<string | null, MapFolderRow[]>();
  folders.forEach((f) => {
    const key = f.parent_id;
    if (!childFolders.has(key)) childFolders.set(key, []);
    childFolders.get(key)!.push(f);
  });
  const mapsInFolder = new Map<string | null, MapFolderTreeMap[]>();
  const folderIds = new Set(folders.map((f) => f.id));
  maps.forEach((m) => {
    const key = m.folder_id && folderIds.has(m.folder_id) ? m.folder_id : null;
    if (!mapsInFolder.has(key)) mapsInFolder.set(key, []);
    mapsInFolder.get(key)!.push(m);
  });

  const rows: TreeRow[] = [];
  function walk(parentId: string | null, depth: number) {
    for (const folder of childFolders.get(parentId) ?? []) {
      rows.push({ type: 'folder', folder, depth });
      for (const m of mapsInFolder.get(folder.id) ?? []) {
        rows.push({ type: 'map', map: m, depth: depth + 1 });
      }
      walk(folder.id, depth + 1);
    }
  }
  walk(null, 0);
  for (const m of mapsInFolder.get(null) ?? []) {
    rows.push({ type: 'map', map: m, depth: 0 });
  }
  return rows;
}

export function MapFolderTree({ database, maps, selectedMapId, onSelectMap }: MapFolderTreeProps) {
  const { t } = useTranslation();
  const [folders, setFolders] = useState<MapFolderRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');

  function reload() {
    listFolders(database).then(setFolders).catch(console.error);
  }

  useEffect(() => {
    reload();
  }, [database]);

  const rows = flattenTree(folders, maps);

  function startRename(folder: MapFolderRow) {
    setEditingId(folder.id);
    setDraftName(folder.name);
  }

  function commitRename(folder: MapFolderRow) {
    setEditingId(null);
    renameFolder(database, folder.id, draftName).then(reload).catch(console.error);
  }

  function handleCreateFolder(parentId: string | null) {
    createFolder(database, { name: t('mapFolderTree.newFolderDefaultName', 'Neuer Ordner'), parent_id: parentId }).then(reload).catch(console.error);
  }

  function handleDeleteFolder(id: string) {
    deleteFolder(database, id).then(reload).catch(console.error);
  }

  function handleMoveMap(mapId: string, folderId: string) {
    void moveMap(database, mapId, folderId || null);
  }

  function handleMoveFolder(folderId: string, newParentId: string) {
    moveFolder(database, folderId, newParentId || null).then(reload).catch(console.error);
  }

  function renderMapRow(m: MapFolderTreeMap, depth: number) {
    return (
      <li key={`map-${m.id}`} className={`map-folder-tree__map-row${selectedMapId === m.id ? ' map-folder-tree__map-row--active' : ''}`} aria-label={m.title} style={{ paddingLeft: depth * 16 }}>
        <span className="map-folder-tree__map-title" onClick={() => onSelectMap?.(m.id)}>{m.title}</span>
        <select
          aria-label={t('mapFolderTree.moveMapTo', 'Verschieben nach')}
          value={m.folder_id ?? ''}
          onChange={(e) => handleMoveMap(m.id, e.target.value)}
        >
          <option value="">{t('mapFolderTree.noFolder', '(kein Ordner)')}</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </li>
    );
  }

  function renderFolderRow(folder: MapFolderRow, depth: number) {
    return (
      <li key={`folder-${folder.id}`} className="map-folder-tree__folder-row" aria-label={folder.name} style={{ paddingLeft: depth * 16 }}>
        <span className="map-folder-tree__folder-icon" aria-hidden="true">📁</span>
        {editingId === folder.id ? (
          <input
            className="map-folder-tree__rename-input"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={() => commitRename(folder)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(folder); }}
            autoFocus
          />
        ) : (
          <span className="map-folder-tree__folder-name">{folder.name}</span>
        )}
        <button type="button" onClick={() => startRename(folder)}>{t('mapFolderTree.rename', 'Umbenennen')}</button>
        <button type="button" onClick={() => handleDeleteFolder(folder.id)}>{t('mapFolderTree.delete', 'Löschen')}</button>
        <button type="button" onClick={() => handleCreateFolder(folder.id)}>{t('mapFolderTree.newSubfolder', '+ Unterordner')}</button>
        <select
          aria-label={t('mapFolderTree.moveFolderTo', 'Ordner verschieben nach')}
          value={folder.parent_id ?? ''}
          onChange={(e) => handleMoveFolder(folder.id, e.target.value)}
        >
          <option value="">{t('mapFolderTree.rootOption', '(Wurzel)')}</option>
          {folders.filter((f) => f.id !== folder.id).map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </li>
    );
  }

  return (
    <div className="map-folder-tree">
      <button type="button" className="map-folder-tree__new-folder-btn" onClick={() => handleCreateFolder(null)}>
        {t('mapFolderTree.newFolder', 'Neuer Ordner')}
      </button>
      <ul className="map-folder-tree__root">
        {rows.map((row) => (row.type === 'folder' ? renderFolderRow(row.folder, row.depth) : renderMapRow(row.map, row.depth)))}
      </ul>
    </div>
  );
}
