import { useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TreeItem {
  id: string;
  label: string;
}

export interface TreeNode {
  path: string;
  name: string;
  children: TreeNode[];
  items: TreeItem[];
  color?: string | null;
}

export interface NestedTreeProps {
  root: TreeNode[];
  ungrouped?: TreeItem[];
  renderItem: (item: TreeItem) => ReactNode;
  activeItemId?: string | null;
  onItemClick?: (id: string, e: React.MouseEvent) => void;
  onFolderMove: (oldPath: string, newPath: string) => void;
  onItemMove: (itemId: string, newGroup: string) => void;
  onCreateFolder?: (name: string) => void;
  header?: ReactNode;
  searchable?: boolean;
  onResizeStart?: (e: React.MouseEvent) => void;
  /** Enables the "⋮" folder menu (Löschen). Menu is hidden until hovered/opened — never a permanent button in the drag path. */
  onDeleteFolder?: (node: TreeNode) => void;
  /** Enables a color swatch in the folder's "Bearbeiten" (rename) row. */
  onFolderColorChange?: (path: string, color: string) => void;
  /** Persists collapsed/expanded folder state in localStorage across remounts (per-tree key, e.g. "pin-tree-<mapId>"). Omit to keep it session-only. */
  persistKey?: string;
}

function collapsedStorageKey(persistKey: string): string {
  return `nestedTree.collapsed.${persistKey}`;
}

function loadCollapsed(persistKey?: string): Set<string> {
  if (!persistKey) return new Set();
  try {
    const raw = localStorage.getItem(collapsedStorageKey(persistKey));
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

type DragPayload = { kind: 'item'; id: string } | { kind: 'folder'; path: string };

type PointerDrag = {
  payload: DragPayload;
  label: string;
  ghostX: number;
  ghostY: number;
  dropPath: string | null;
};

const FOLDER_COLORS = ['#e0e0e0', '#ef9a9a', '#ffcc80', '#fff59d', '#a5d6a7', '#90caf9', '#ce93d8'];

// ── FolderNode ─────────────────────────────────────────────────────────────────

function FolderNode({
  node, depth, collapsed, onToggle,
  renderItem, activeItemId, onItemClick,
  renamingPath, renameVal, onRenameVal, onRenameCommit, onRenameStart, onRenameCancel,
  dropHighlight, dragSourcePath, onPointerDown,
  onDeleteFolder, onFolderColorChange, menuOpenPath, onToggleMenu,
}: {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (p: string) => void;
  renderItem: (item: TreeItem) => ReactNode;
  activeItemId?: string | null;
  onItemClick?: (id: string, e: React.MouseEvent) => void;
  renamingPath: string | null;
  renameVal: string;
  onRenameVal: (v: string) => void;
  onRenameCommit: () => void;
  onRenameStart: (p: string) => void;
  onRenameCancel: () => void;
  dropHighlight: boolean;
  dragSourcePath: string | null;
  onPointerDown: (payload: DragPayload, label: string, e: React.PointerEvent) => void;
  onDeleteFolder?: (node: TreeNode) => void;
  onFolderColorChange?: (path: string, color: string) => void;
  menuOpenPath: string | null;
  onToggleMenu: (path: string | null) => void;
}) {
  const { t } = useTranslation();
  const isOpen = !collapsed.has(node.path);
  const indent = depth * 14;
  const hasMenu = Boolean(onDeleteFolder || onFolderColorChange);
  const menuOpen = menuOpenPath === node.path;

  function countItems(n: TreeNode): number {
    return n.items.length + n.children.reduce((s, c) => s + countItems(c), 0);
  }
  const itemCount = countItems(node);

  return (
    <div>
      <div
        className={`map-pin-tree__group-header${dropHighlight ? ' drop-target' : ''}`}
        style={{ paddingLeft: 12 + indent, cursor: 'grab', opacity: dragSourcePath === node.path ? 0.35 : 1 }}
        data-drop-path={node.path}
        onClick={() => onToggle(node.path)}
        onPointerDown={(e) => { e.stopPropagation(); onPointerDown({ kind: 'folder', path: node.path }, node.name, e); }}
      >
        <span className="map-pin-tree__group-arrow">{isOpen ? '▼' : '▶'}</span>
        {renamingPath === node.path ? (
          <>
            <input className="map-pin-tree__rename-input" value={renameVal} autoFocus
              onChange={(e) => onRenameVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel(); }}
              onClick={(e) => e.stopPropagation()} />
            {onFolderColorChange && (
              <input
                type="color"
                aria-label={t('nestedTree.folderColor', 'Ordnerfarbe')}
                className="map-pin-tree__color-input"
                value={node.color ?? '#888888'}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => onFolderColorChange(node.path, e.target.value)}
              />
            )}
            <button type="button" className="map-pin-tree__rename-commit-btn"
              title={t('nestedTree.save', 'Speichern')}
              onClick={(e) => { e.stopPropagation(); onRenameCommit(); }}>✓</button>
            <button type="button" className="map-pin-tree__rename-commit-btn"
              title={t('nestedTree.cancel', 'Abbrechen')}
              onClick={(e) => { e.stopPropagation(); onRenameCancel(); }}>✕</button>
          </>
        ) : (
          <span className="map-pin-tree__group-name"
            onDoubleClick={(e) => { e.stopPropagation(); onRenameStart(node.path); }}>
            {node.color && <span className="map-pin-tree__group-color-dot" style={{ background: node.color }} />}
            📁 {node.name}
          </span>
        )}
        <span className="map-pin-tree__group-count">{itemCount}</span>
        {hasMenu && (
          <div className="map-pin-tree__group-menu-wrap">
            <button
              type="button"
              className={`map-pin-tree__group-menu-btn${menuOpen ? ' is-open' : ''}`}
              title={t('nestedTree.folderMenu', 'Ordner-Menü')}
              onClick={(e) => { e.stopPropagation(); onToggleMenu(menuOpen ? null : node.path); }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="map-pin-tree__group-menu"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}>
                <button type="button" onClick={() => { onRenameStart(node.path); onToggleMenu(null); }}>
                  {t('nestedTree.editFolder', 'Bearbeiten')}
                </button>
                {onDeleteFolder && (
                  <button type="button" onClick={() => { onDeleteFolder(node); onToggleMenu(null); }}>
                    {t('nestedTree.deleteFolder', 'Löschen')}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {renamingPath === node.path && onFolderColorChange && (
        <div className="map-pin-tree__color-swatches" style={{ paddingLeft: 12 + indent + 14 }}>
          {FOLDER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className="map-pin-tree__color-swatch"
              style={{ background: c }}
              title={c}
              onClick={() => onFolderColorChange(node.path, c)}
            />
          ))}
        </div>
      )}
      {isOpen && (
        <>
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1}
              collapsed={collapsed} onToggle={onToggle}
              renderItem={renderItem} activeItemId={activeItemId} onItemClick={onItemClick}
              renamingPath={renamingPath} renameVal={renameVal}
              onRenameVal={onRenameVal} onRenameCommit={onRenameCommit}
              onRenameStart={onRenameStart} onRenameCancel={onRenameCancel}
              dropHighlight={dropHighlight} dragSourcePath={dragSourcePath}
              onPointerDown={onPointerDown}
              onDeleteFolder={onDeleteFolder} onFolderColorChange={onFolderColorChange}
              menuOpenPath={menuOpenPath} onToggleMenu={onToggleMenu} />
          ))}
          {node.items.map((item) => (
            <div
              key={item.id}
              role="button"
              tabIndex={0}
              className={`map-pin-tree__item${activeItemId === item.id ? ' active' : ''}`}
              style={{ paddingLeft: 12 + indent + 14, cursor: 'grab', userSelect: 'none' }}
              onClick={(e) => onItemClick?.(item.id, e as unknown as React.MouseEvent)}
              onKeyDown={(e) => { if (e.key === 'Enter') onItemClick?.(item.id, e as unknown as React.MouseEvent); }}
              onPointerDown={(e) => onPointerDown({ kind: 'item', id: item.id }, item.label, e)}
            >
              {renderItem(item)}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── NestedTree ─────────────────────────────────────────────────────────────────

export function NestedTree({
  root, ungrouped = [], renderItem, activeItemId, onItemClick,
  onFolderMove, onItemMove, onCreateFolder, header, searchable, onResizeStart,
  onDeleteFolder, onFolderColorChange, persistKey,
}: NestedTreeProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(() => loadCollapsed(persistKey));

  useEffect(() => {
    if (!persistKey) return;
    try { localStorage.setItem(collapsedStorageKey(persistKey), JSON.stringify([...collapsed])); } catch { /* storage unavailable/full — UI state only, safe to skip */ }
  }, [collapsed, persistKey]);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [drag, setDrag] = useState<PointerDrag | null>(null);
  const dragRef = useRef<PointerDrag | null>(null);
  const [menuOpenPath, setMenuOpenPath] = useState<string | null>(null);

  useEffect(() => {
    if (menuOpenPath === null) return;
    const close = () => setMenuOpenPath(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpenPath]);

  const q = search.toLowerCase();

  function filterNodes(nodes: TreeNode[]): TreeNode[] {
    if (!q) return nodes;
    return nodes.flatMap((node) => {
      const filteredChildren = filterNodes(node.children);
      const filteredItems = node.items.filter((i) => i.label.toLowerCase().includes(q));
      const nameMatch = node.name.toLowerCase().includes(q);
      if (nameMatch || filteredChildren.length || filteredItems.length) {
        return [{ ...node, children: filteredChildren, items: nameMatch ? node.items : filteredItems }];
      }
      return [];
    });
  }

  const visibleRoot = filterNodes(root);
  const visibleUngrouped = q ? ungrouped.filter((i) => i.label.toLowerCase().includes(q)) : ungrouped;

  function toggleCollapse(path: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(path)) n.delete(path); else n.add(path);
      return n;
    });
  }

  function commitRename() {
    if (renamingPath !== null) onFolderMove(renamingPath, renameVal.trim());
    setRenamingPath(null);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (name) onCreateFolder?.(name);
    setNewFolderName('');
    setNewFolderInput(false);
  }

  function startDrag(payload: DragPayload, label: string, e: React.PointerEvent) {
    e.preventDefault();
    const d: PointerDrag = { payload, label, ghostX: e.clientX, ghostY: e.clientY, dropPath: null };
    setDrag(d);
    dragRef.current = d;

    function onMove(ev: PointerEvent) {
      const el = document.elementFromPoint(ev.clientX, ev.clientY);
      const dropEl = (el as HTMLElement | null)?.closest('[data-drop-path]') as HTMLElement | null;
      let dropPath: string | null = null;
      if (dropEl) {
        const p = dropEl.getAttribute('data-drop-path') ?? '';
        const cur = dragRef.current;
        if (cur?.payload.kind === 'folder') {
          const src = cur.payload.path;
          if (p !== src && !p.startsWith(src + '/')) dropPath = p;
        } else {
          dropPath = p;
        }
      }
      const updated: PointerDrag = { ...dragRef.current!, ghostX: ev.clientX, ghostY: ev.clientY, dropPath };
      dragRef.current = updated;
      setDrag({ ...updated });
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      const cur = dragRef.current;
      if (cur && cur.dropPath !== null) {
        if (cur.payload.kind === 'item') {
          onItemMove(cur.payload.id, cur.dropPath);
        } else {
          const folderName = cur.payload.path.split('/').pop()!;
          const newPath = cur.dropPath ? `${cur.dropPath}/${folderName}` : folderName;
          if (newPath !== cur.payload.path) onFolderMove(cur.payload.path, newPath);
        }
      }
      setDrag(null);
      dragRef.current = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  return (
    <div className="map-pin-tree">
      {onResizeStart && <div className="map-pin-tree__resize-handle" onMouseDown={onResizeStart} />}
      <div className="map-pin-editor__header">
        {header}
        {onCreateFolder && (
          <button className="map-pin-tree__new-folder-btn" title={t('nestedTree.newFolder', 'Neuer Ordner')}
            onClick={() => setNewFolderInput(true)}>📁+</button>
        )}
      </div>

      {newFolderInput && (
        <div className="map-pin-tree__new-folder-row">
          <input className="map-pin-tree__rename-input" autoFocus
            placeholder={t('nestedTree.folderName', 'Ordnername…')}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderInput(false); }}
          />
          <button onClick={createFolder} style={{ fontSize: '0.75rem' }}>✓</button>
          <button onClick={() => setNewFolderInput(false)} style={{ fontSize: '0.75rem' }}>✕</button>
        </div>
      )}

      {searchable && (
        <div className="map-pin-tree__search-wrap">
          <input
            type="search"
            className="map-pin-tree__search"
            placeholder={t('nestedTree.search', 'Suchen…')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      <div className="map-pin-tree__list" data-drop-path="">
        {visibleRoot.length === 0 && visibleUngrouped.length === 0 && (
          <div className="map-pin-tree__empty">
            {t('nestedTree.empty', 'Keine Einträge.')}
          </div>
        )}
        {visibleUngrouped.map((item) => (
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className={`map-pin-tree__item${activeItemId === item.id ? ' active' : ''}`}
            style={{ paddingLeft: 12, cursor: 'grab', userSelect: 'none' }}
            onClick={(e) => onItemClick?.(item.id, e as unknown as React.MouseEvent)}
            onKeyDown={(e) => { if (e.key === 'Enter') onItemClick?.(item.id, e as unknown as React.MouseEvent); }}
            onPointerDown={(e) => startDrag({ kind: 'item', id: item.id }, item.label, e)}
          >
            {renderItem(item)}
          </div>
        ))}
        {visibleRoot.map((node) => (
          <FolderNode key={node.path} node={node} depth={0}
            collapsed={collapsed} onToggle={toggleCollapse}
            renderItem={renderItem} activeItemId={activeItemId} onItemClick={onItemClick}
            renamingPath={renamingPath} renameVal={renameVal}
            onRenameVal={setRenameVal} onRenameCommit={commitRename}
            onRenameStart={(p) => { setRenamingPath(p); setRenameVal(p); }}
            onRenameCancel={() => setRenamingPath(null)}
            dropHighlight={drag?.dropPath === node.path}
            dragSourcePath={drag?.payload.kind === 'folder' ? drag.payload.path : null}
            onPointerDown={startDrag}
            onDeleteFolder={onDeleteFolder} onFolderColorChange={onFolderColorChange}
            menuOpenPath={menuOpenPath} onToggleMenu={setMenuOpenPath} />
        ))}
      </div>

      {drag && (
        <div style={{
          position: 'fixed', left: drag.ghostX + 14, top: drag.ghostY - 10,
          background: 'var(--color-surface)',
          border: `1px solid ${drag.dropPath !== null ? 'var(--color-accent)' : 'var(--color-border)'}`,
          borderRadius: 4, padding: '3px 10px', fontSize: '0.82rem',
          color: 'var(--color-text)', opacity: 0.92, pointerEvents: 'none',
          zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          {drag.label}
        </div>
      )}
    </div>
  );
}

// ── Adapter: Pfad-Strings → TreeNode[] ────────────────────────────────────────

export function fromPathStrings(
  items: Array<{ id: string; groupPath: string; label: string }>,
  explicitFolderPaths: string[] = [],
  colorByPath: Map<string, string> = new Map(),
): { root: TreeNode[]; ungrouped: TreeItem[] } {
  const nodeMap = new Map<string, TreeNode>();
  const ungrouped: TreeItem[] = [];

  function getNode(path: string): TreeNode {
    if (nodeMap.has(path)) return nodeMap.get(path)!;
    const segments = path.split('/');
    const name = segments[segments.length - 1];
    const node: TreeNode = { path, name, children: [], items: [], color: colorByPath.get(path) };
    nodeMap.set(path, node);
    if (segments.length > 1) {
      const parentPath = segments.slice(0, -1).join('/');
      getNode(parentPath).children.push(node);
    }
    return node;
  }

  for (const fp of explicitFolderPaths) {
    if (fp) getNode(fp);
  }

  for (const item of items) {
    const g = item.groupPath.trim();
    if (!g) {
      ungrouped.push({ id: item.id, label: item.label });
      continue;
    }
    getNode(g).items.push({ id: item.id, label: item.label });
  }

  const root = [...nodeMap.values()]
    .filter((n) => !n.path.includes('/'))
    .sort((a, b) => a.name.localeCompare(b.name));

  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortChildren);
  }
  root.forEach(sortChildren);

  return { root, ungrouped };
}

// ── Adapter: parent_id → TreeNode[] ──────────────────────────────────────────

export function fromParentId(
  folders: Array<{ id: string; parent_id: string | null; label: string; color?: string | null }>,
  items: Array<{ id: string; folderId: string | null; label: string }> = [],
): { root: TreeNode[]; ungrouped: TreeItem[]; pathToId: Map<string, string> } {
  const map = new Map<string, TreeNode & { _folderId: string; _parentId: string | null }>();

  for (const f of folders) {
    map.set(f.id, {
      _folderId: f.id,
      _parentId: f.parent_id,
      path: f.label,
      name: f.label,
      children: [],
      items: [],
      color: f.color,
    });
  }

  const roots: Array<TreeNode & { _folderId: string; _parentId: string | null }> = [];

  for (const node of map.values()) {
    if (node._parentId === null || !map.has(node._parentId)) {
      roots.push(node);
    } else {
      map.get(node._parentId)!.children.push(node);
    }
  }
  roots.sort((a, b) => a.name.localeCompare(b.name));

  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortChildren);
  }
  roots.forEach(sortChildren);

  function assignPaths(node: TreeNode, parentPath: string) {
    node.path = parentPath ? `${parentPath}/${node.name}` : node.name;
    for (const child of node.children) assignPaths(child, node.path);
  }
  for (const r of roots) assignPaths(r, '');

  const pathToId = new Map<string, string>();
  for (const node of map.values()) pathToId.set(node.path, node._folderId);

  const ungrouped: TreeItem[] = [];
  for (const item of items) {
    const node = item.folderId ? map.get(item.folderId) : undefined;
    if (node) node.items.push({ id: item.id, label: item.label });
    else ungrouped.push({ id: item.id, label: item.label });
  }

  return { root: roots, ungrouped, pathToId };
}
