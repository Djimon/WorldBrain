import { useState, useRef, useEffect, useCallback } from 'react';
import { getMap, getAssetUrl, loadGridSettings, saveGridSettings } from '../services/map-service';
import type { DatabaseLike } from '../services/entity-service';
import { getMarkersForMap, createMarker, updateMarker, deleteMarker } from '../services/map-marker-service';
import type { MarkerRow } from '../services/map-marker-service';
import { getActivatedCells, clearAllCells, setCellState } from '../services/session-grid-service';
import { listEntitiesByType } from '../services/entity-service';
import { GridOverlaySvg, GridControlsPanel, CellContextMenu, DEFAULT_GRID_SETTINGS } from './MapGrid';
import type { GridSettings } from './MapGrid';

type Mode = 'navigate' | 'pin' | 'grid' | 'measure';

const PIN_SIZE_PX: Record<string, number> = { S: 18, M: 26, L: 38 };

interface Props {
  mapId: string;
  sessionId?: string;
  database: DatabaseLike;
  showCoordinates?: boolean;
  onNavigateToEntity?: (entityId: string) => void;
}

function parsePinGeometry(json: string): { x: number; y: number; notes?: string } {
  try { return JSON.parse(json) as { x: number; y: number; notes?: string }; } catch { return { x: 0, y: 0 }; }
}

const PIN_ICONS = [
  { key: 'pin',         emoji: 'ðŸ“', label: 'Pin' },
  { key: 'danger',      emoji: 'â˜ ï¸', label: 'Gefahr' },
  { key: 'treasure',    emoji: 'ðŸ’°', label: 'Schatz' },
  { key: 'note',        emoji: 'ðŸ“', label: 'Notiz' },
  { key: 'question',    emoji: 'â“', label: 'Frage' },
  { key: 'exclamation', emoji: 'â—', label: 'Wichtig' },
  { key: 'combat',      emoji: 'âš”ï¸', label: 'Kampf' },
] as const;

type PinIconKey = typeof PIN_ICONS[number]['key'];

function getPinEmoji(styleJson: string): string {
  try {
    const s = JSON.parse(styleJson) as { icon?: string };
    return PIN_ICONS.find((i) => i.key === s.icon)?.emoji ?? 'ðŸ“';
  } catch { return 'ðŸ“'; }
}

// â”€â”€ Pin Tree (nested folders via "/" in group_name) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface TreeNode {
  path: string;          // full path, e.g. "StÃ¤dte/HauptstÃ¤dte"
  name: string;          // last segment
  children: TreeNode[];
  pins: MarkerRow[];
}

function buildTree(markers: MarkerRow[]): { root: TreeNode[]; ungrouped: MarkerRow[] } {
  const nodeMap = new Map<string, TreeNode>();
  const ungrouped: MarkerRow[] = [];

  function getNode(path: string): TreeNode {
    if (nodeMap.has(path)) return nodeMap.get(path)!;
    const segments = path.split('/');
    const name = segments[segments.length - 1];
    const node: TreeNode = { path, name, children: [], pins: [] };
    nodeMap.set(path, node);
    if (segments.length > 1) {
      const parentPath = segments.slice(0, -1).join('/');
      getNode(parentPath).children.push(node);
    }
    return node;
  }

  for (const m of markers) {
    const g = (m.group_name ?? '').trim();
    if (!g) { ungrouped.push(m); continue; }
    getNode(g).pins.push(m);
  }

  // top-level nodes (path has no "/")
  const root = [...nodeMap.values()]
    .filter((n) => !n.path.includes('/'))
    .sort((a, b) => a.name.localeCompare(b.name));

  // sort children recursively
  function sortChildren(node: TreeNode) {
    node.children.sort((a, b) => a.name.localeCompare(b.name));
    node.children.forEach(sortChildren);
  }
  root.forEach(sortChildren);

  return { root, ungrouped };
}

interface PinTreeProps {
  markers: MarkerRow[];
  editingId: string | null;
  onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  onClose: () => void;
  entities: { id: string; title: string }[];
  onGroupRename: (groupOld: string, groupNew: string) => void;
}

function FolderNode({
  node, depth, collapsed, onToggle, editingId, onSelect, entities,
  renamingPath, renameVal, onRenameVal, onRenameCommit, onRenameStart, onRenameCancel,
  dragOverPath, onDragOver, onDrop, onDragStart, draggingFolder,
}: {
  node: TreeNode; depth: number;
  collapsed: Set<string>; onToggle: (p: string) => void;
  editingId: string | null; onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  entities: { id: string; title: string }[];
  renamingPath: string | null; renameVal: string;
  onRenameVal: (v: string) => void; onRenameCommit: () => void;
  onRenameStart: (p: string) => void; onRenameCancel: () => void;
  dragOverPath: string;
  onDragOver: (path: string) => void;
  onDrop: (targetPath: string) => void;
  onDragStart: (payload: DragPayload) => void;
  draggingFolder: string | null;
}) {
  const isOpen = !collapsed.has(node.path);
  const indent = depth * 14;
  const pinCount = node.pins.length + node.children.reduce((s, c) => s + c.pins.length, 0);
  const isDropTarget = dragOverPath === node.path;
  // can't drop a folder into itself or its own descendants
  const isDropForbidden = draggingFolder !== null &&
    (node.path === draggingFolder || node.path.startsWith(draggingFolder + '/'));

  return (
    <div>
      <div
        className={`map-pin-tree__group-header${isDropTarget && !isDropForbidden ? ' drop-target' : ''}`}
        style={{ paddingLeft: 12 + indent, cursor: 'grab', opacity: draggingFolder === node.path ? 0.4 : 1 }}
        draggable
        onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); onDragStart({ kind: 'folder', path: node.path }); }}
        onClick={() => onToggle(node.path)}
        onDragOver={(e) => { e.preventDefault(); if (!isDropForbidden) onDragOver(node.path); }}
        onDragLeave={() => onDragOver('')}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (!isDropForbidden) onDrop(node.path); }}
      >
        <span className="map-pin-tree__group-arrow">{isOpen ? 'â–¼' : 'â–¶'}</span>
        {renamingPath === node.path ? (
          <input className="map-pin-tree__rename-input" value={renameVal} autoFocus
            onChange={(e) => onRenameVal(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel(); }}
            onClick={(e) => e.stopPropagation()} />
        ) : (
          <span className="map-pin-tree__group-name"
            onDoubleClick={(e) => { e.stopPropagation(); onRenameStart(node.path); }}>
            ðŸ“ {node.name}
          </span>
        )}
        <span className="map-pin-tree__group-count">{pinCount}</span>
      </div>
      {isOpen && (
        <>
          {node.children.map((child) => (
            <FolderNode key={child.path} node={child} depth={depth + 1}
              collapsed={collapsed} onToggle={onToggle}
              editingId={editingId} onSelect={onSelect} entities={entities}
              renamingPath={renamingPath} renameVal={renameVal}
              onRenameVal={onRenameVal} onRenameCommit={onRenameCommit}
              onRenameStart={onRenameStart} onRenameCancel={onRenameCancel}
              dragOverPath={dragOverPath} onDragOver={onDragOver} onDrop={onDrop}
              onDragStart={onDragStart} draggingFolder={draggingFolder} />
          ))}
          {node.pins.map((m) => (
            <PinRow key={m.id} m={m} indent={indent + 14} editingId={editingId} onSelect={onSelect} entities={entities}
              onDragStart={(id) => onDragStart({ kind: 'pin', id })} />
          ))}
        </>
      )}
    </div>
  );
}

function PinRow({ m, indent, editingId, onSelect, entities, onDragStart }: {
  m: MarkerRow; indent: number; editingId: string | null;
  onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  entities: { id: string; title: string }[];
  onDragStart: (id: string) => void;
}) {
  const linked = entities.find((e) => e.id === m.entity_id);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`map-pin-tree__item${editingId === m.id ? ' active' : ''}`}
      style={{ paddingLeft: 12 + indent, cursor: 'grab' }}
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(m.id); }}
      onClick={(e) => onSelect(m, e as unknown as React.MouseEvent)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(m, e as unknown as React.MouseEvent); }}
    >
      <span style={{ marginRight: 6 }}>{getPinEmoji(m.style_json)}</span>
      <span className="map-pin-tree__label">{m.label_text || '(kein Name)'}</span>
      {linked && <span className="map-pin-tree__sub">{linked.title}</span>}
    </div>
  );
}

type DragPayload = { kind: 'pin'; id: string } | { kind: 'folder'; path: string };

interface PinTreeProps {
  markers: MarkerRow[];
  editingId: string | null;
  onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  onClose: () => void;
  entities: { id: string; title: string }[];
  onGroupRename: (groupOld: string, groupNew: string) => void;
  onPinMove: (markerId: string, newGroup: string) => void;
}

function PinTree({ markers, editingId, onSelect, onClose, entities, onGroupRename, onPinMove }: PinTreeProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [extraFolders, setExtraFolders] = useState<string[]>([]);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dragOverPath, setDragOverPath] = useState('');

  const q = search.toLowerCase();
  const filtered = q
    ? markers.filter((m) => (m.label_text ?? '').toLowerCase().includes(q) || (m.group_name ?? '').toLowerCase().includes(q))
    : markers;

  // merge extra (empty) folders into the tree by injecting fake pins
  const augmented = [...filtered];
  const { root, ungrouped } = buildTree(augmented);
  // add extra empty folders to root if not already present
  const extraRoots = extraFolders
    .filter((f) => !root.find((n) => n.path === f))
    .map((f): TreeNode => ({ path: f, name: f.split('/').pop()!, children: [], pins: [] }));
  const allRoot = [...root, ...extraRoots].sort((a, b) => a.name.localeCompare(b.name));

  function toggleCollapse(path: string) {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  }

  function commitRename() {
    if (renamingPath !== null) onGroupRename(renamingPath, renameVal.trim());
    setRenamingPath(null);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (name) setExtraFolders((prev) => [...prev, name]);
    setNewFolderName('');
    setNewFolderInput(false);
  }

  function handleDrop(targetPath: string) {
    if (!dragPayload) { setDragOverPath(''); return; }
    if (dragPayload.kind === 'pin') {
      onPinMove(dragPayload.id, targetPath);
    } else {
      // folder drop: move folder into targetPath
      const folderPath = dragPayload.path;
      const folderName = folderPath.split('/').pop()!;
      const newPath = targetPath ? `${targetPath}/${folderName}` : folderName;
      if (newPath !== folderPath) onGroupRename(folderPath, newPath);
    }
    setDragPayload(null);
    setDragOverPath('');
  }

  return (
    <div className="map-pin-tree">
      <div className="map-pin-editor__header">
        <span>Pins ({markers.length})</span>
        <button className="map-pin-tree__new-folder-btn" title="Neuer Ordner"
          onClick={() => setNewFolderInput(true)}>ðŸ“+</button>
        <button onClick={onClose}>âœ•</button>
      </div>

      {newFolderInput && (
        <div className="map-pin-tree__new-folder-row">
          <input className="map-pin-tree__rename-input" autoFocus placeholder="Ordnernameâ€¦"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderInput(false); }}
          />
          <button onClick={createFolder} style={{ fontSize: '0.75rem' }}>âœ“</button>
          <button onClick={() => setNewFolderInput(false)} style={{ fontSize: '0.75rem' }}>âœ•</button>
        </div>
      )}

      <div className="map-pin-tree__search-wrap">
        <input className="map-pin-tree__search" placeholder="Suchenâ€¦" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="map-pin-tree__list"
        onDragOver={(e) => { e.preventDefault(); setDragOverPath('__root'); }}
        onDragLeave={() => setDragOverPath('')}
        onDrop={(e) => { e.preventDefault(); if (dragOverPath === '__root') handleDrop(''); }}
      >
        {allRoot.length === 0 && ungrouped.length === 0 && (
          <div className="map-pin-tree__empty">Keine Pins. Pins auf der Karte setzen und hier per Drag in Ordner sortieren.</div>
        )}
        {ungrouped.map((m) => (
          <PinRow key={m.id} m={m} indent={0} editingId={editingId} onSelect={onSelect} entities={entities}
            onDragStart={(id) => setDragPayload({ kind: 'pin', id })} />
        ))}
        {allRoot.map((node) => (
          <FolderNode key={node.path} node={node} depth={0}
            collapsed={collapsed} onToggle={toggleCollapse}
            editingId={editingId} onSelect={onSelect} entities={entities}
            renamingPath={renamingPath} renameVal={renameVal}
            onRenameVal={setRenameVal} onRenameCommit={commitRename}
            onRenameStart={(p) => { setRenamingPath(p); setRenameVal(p); }}
            onRenameCancel={() => setRenamingPath(null)}
            dragOverPath={dragOverPath} onDragOver={setDragOverPath} onDrop={handleDrop}
            onDragStart={setDragPayload}
            draggingFolder={dragPayload?.kind === 'folder' ? dragPayload.path : null} />
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Ruler overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface RulerPoint { x: number; y: number }

function RulerOverlay({
  p1, p2, scale, offset, cellSize, measureValue, measureUnit, rulerColor, rulerOpacity, rulerWidth,
}: {
  p1: RulerPoint; p2: RulerPoint | null;
  scale: number; offset: { x: number; y: number };
  cellSize: number; measureValue: number; measureUnit: string;
  rulerColor: string; rulerOpacity: number; rulerWidth: number;
}) {
  if (!p2) return null;
  const sx1 = p1.x * scale + offset.x;
  const sy1 = p1.y * scale + offset.y;
  const sx2 = p2.x * scale + offset.x;
  const sy2 = p2.y * scale + offset.y;
  const pixelDist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  const realDist = (pixelDist / cellSize) * measureValue;
  const label = `${realDist.toFixed(2)} ${measureUnit}`;
  const mx = (sx1 + sx2) / 2;
  const my = (sy1 + sy2) / 2;
  const labelW = label.length * 7 + 16;

  return (
    <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 8 }}>
      <line x1={sx1} y1={sy1} x2={sx2} y2={sy2}
        stroke={rulerColor} strokeWidth={rulerWidth} strokeOpacity={rulerOpacity} strokeDasharray="6 3" />
      <circle cx={sx1} cy={sy1} r={rulerWidth + 3} fill={rulerColor} fillOpacity={rulerOpacity} />
      <circle cx={sx2} cy={sy2} r={rulerWidth + 3} fill={rulerColor} fillOpacity={rulerOpacity} />
      <rect x={mx - labelW / 2} y={my - 12} width={labelW} height={20} rx={4} fill="rgba(0,0,0,0.75)" />
      <text x={mx} y={my + 4} textAnchor="middle" fill={rulerColor} fillOpacity={rulerOpacity} fontSize={12} fontFamily="monospace">{label}</text>
    </svg>
  );
}

// â”€â”€ MapViewer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function MapViewer({ mapId, sessionId = 'default', database, showCoordinates, onNavigateToEntity }: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [markers, setMarkers] = useState<MarkerRow[]>([]);
  const [cells, setCells] = useState<Map<string, number>>(new Map());
  const [gridSettings, setGridSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>('navigate');
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [editingPin, setEditingPin] = useState<MarkerRow | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEntityId, setEditEntityId] = useState('');
  const [editEntityIds, setEditEntityIds] = useState<string[]>([]);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [editGroup, setEditGroup] = useState('');
  const [editIcon, setEditIcon] = useState<PinIconKey>('pin');
  const [entities, setEntities] = useState<{ id: string; type: string; title: string }[]>([]);
  const [showPinTree, setShowPinTree] = useState(false);
  const [cellMenu, setCellMenu] = useState<{ x: number; y: number; cellKey: string } | null>(null);
  const [rulerP1, setRulerP1] = useState<RulerPoint | null>(null);
  const [rulerP2, setRulerP2] = useState<RulerPoint | null>(null);

  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function reloadMarkers() {
    getMarkersForMap(database, mapId).then(setMarkers).catch(console.error);
  }

  useEffect(() => {
    getMap(database, mapId).then((m) => {
      if (!m) return;
      setImgSrc(getAssetUrl(m.asset_id));
      if (m.image_width_px) setImgSize({ w: m.image_width_px, h: m.image_height_px });
    }).catch(console.error);
    reloadMarkers();
    getActivatedCells(database, sessionId, mapId)
      .then((rows) => setCells(new Map(rows.map((r) => [r.cell_key, r.state]))))
      .catch(console.error);
    listEntitiesByType({ database, type: null })
      .then((rows) => setEntities(rows as typeof entities))
      .catch(console.error);
    loadGridSettings(database, mapId).then((saved) => {
      if (saved) setGridSettings((prev) => ({ ...prev, ...saved } as GridSettings));
    }).catch(console.error);
  }, [database, mapId, sessionId]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setScale((s) => {
        const ns = Math.min(10, Math.max(0.1, s * factor));
        setOffset((o) => ({
          x: mx - (mx - o.x) * (ns / s),
          y: my - (my - o.y) * (ns / s),
        }));
        return ns;
      });
    }
  }, []);

  function toMapCoords(clientX: number, clientY: number) {
    const rect = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - rect.left - offset.x) / scale, y: (clientY - rect.top - offset.y) / scale };
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (mode !== 'navigate') return;
    setDragging(true);
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (dragging && dragStart.current) {
      setOffset({ x: dragStart.current.ox + (e.clientX - dragStart.current.mx), y: dragStart.current.oy + (e.clientY - dragStart.current.my) });
    }
    if (mode === 'measure' && rulerP1) {
      setRulerP2(toMapCoords(e.clientX, e.clientY));
    }
    if (showCoordinates && containerRef.current) {
      const { x, y } = toMapCoords(e.clientX, e.clientY);
      setCoords({ x: Math.round(x), y: Math.round(y) });
    }
  }

  function handleMouseUp() { setDragging(false); dragStart.current = null; }

  async function handleMapClick(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const pos = toMapCoords(e.clientX, e.clientY);

    if (mode === 'pin') {
      await createMarker(database, {
        map_id: mapId, entity_id: null, kind: 'pin',
        geometry_json: JSON.stringify({ x: Math.round(pos.x), y: Math.round(pos.y), notes: '' }),
        label_text: 'Neuer Pin', elevation_value: null, elevation_unit: null,
        visibility_json: '"public"', style_json: '{}', group_name: '',
      });
      setMode('navigate');
      reloadMarkers();
      return;
    }

    if (mode === 'measure') {
      if (!rulerP1) {
        setRulerP1(pos);
        setRulerP2(null);
      } else {
        setRulerP2(pos); // keep showing result, click again to reset
        setRulerP1(null);
      }
    }
  }

  function openPinEditor(m: MarkerRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (mode === 'grid') return;
    const geo = parsePinGeometry(m.geometry_json);
    setEditingPin(m);
    setEditLabel(m.label_text ?? '');
    setEditNotes(geo.notes ?? '');
    setEditEntityId(m.entity_id ?? '');
    setEditGroup(m.group_name ?? '');
    try {
      const s = JSON.parse(m.style_json) as { icon?: string; extra_entity_ids?: string[] };
      setEditIcon((s.icon as PinIconKey) ?? 'pin');
      setEditEntityIds(Array.isArray(s.extra_entity_ids) ? s.extra_entity_ids : []);
    } catch { setEditIcon('pin'); setEditEntityIds([]); }
  }

  async function savePin() {
    if (!editingPin) return;
    const geo = parsePinGeometry(editingPin.geometry_json);
    await updateMarker(database, editingPin.id, {
      label_text: editLabel,
      entity_id: editEntityId || null,
      geometry_json: JSON.stringify({ ...geo, notes: editNotes }),
      style_json: JSON.stringify({ icon: editIcon, extra_entity_ids: editEntityIds }),
    });
    setEditingPin(null);
    reloadMarkers();
  }

  async function deletePin(id: string) {
    await deleteMarker(database, id);
    setEditingPin(null);
    reloadMarkers();
  }

  async function handleGroupRename(groupOld: string, groupNew: string) {
    if (!groupNew || groupNew === groupOld) return;
    // rename exact matches AND child paths (prefix rename)
    const toRename = markers.filter((m) => {
      const g = m.group_name ?? '';
      return g === groupOld || g.startsWith(groupOld + '/');
    });
    await Promise.all(toRename.map((m) =>
      updateMarker(database, m.id, { group_name: (m.group_name ?? '').replace(groupOld, groupNew) }),
    ));
    reloadMarkers();
  }

  function resetView() { setScale(1); setOffset({ x: 0, y: 0 }); }

  function updateGridSettings(s: GridSettings) {
    setGridSettings(s);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void saveGridSettings(database, mapId, s); }, 800);
  }

  function handleCellContextMenu(cellKey: string, screenX: number, screenY: number) {
    setCellMenu({ x: screenX, y: screenY, cellKey });
  }

  function pickCellState(key: string, stateId: number) {
    void setCellState(database, sessionId, mapId, key, stateId).then(() => {
      const m = new Map(cells);
      if (stateId === 0) m.delete(key); else m.set(key, stateId);
      setCells(m);
    });
    setCellMenu(null);
  }

  // unique group names for autocomplete
  const allGroups = [...new Set(markers.map((m) => m.group_name ?? '').filter(Boolean))].sort();

  const pinPx = PIN_SIZE_PX[gridSettings.pinSize] ?? 26;
  const cursor = mode === 'pin' ? 'crosshair' : mode === 'grid' ? 'cell' : mode === 'measure' ? 'crosshair' : dragging ? 'grabbing' : 'grab';

  if (!imgSrc) return <div className="map-empty">Kein Kartenbild â€” Karte importieren um zu beginnen.</div>;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left toolbar */}
      <div className="map-toolbar">
        <div className="map-toolbar__group">
          <button className={`map-tool-btn${mode === 'navigate' ? ' active' : ''}`} onClick={() => setMode('navigate')} title="Navigieren">ðŸ–</button>
          <button className={`map-tool-btn${mode === 'pin' ? ' active' : ''}`} onClick={() => setMode('pin')} title="Pin setzen">ðŸ“</button>
          <button className={`map-tool-btn${mode === 'grid' ? ' active' : ''}`} onClick={() => setMode('grid')} title="Grid malen">â¬œ</button>
          <button
            className={`map-tool-btn${mode === 'measure' ? ' active' : ''}`}
            onClick={() => { setMode((m) => m === 'measure' ? 'navigate' : 'measure'); setRulerP1(null); setRulerP2(null); }}
            title={`Lineal (1 KÃ¤stchen = ${gridSettings.measureValue} ${gridSettings.measureUnit})`}
          >ðŸ“</button>
        </div>
        <div className="map-toolbar__group">
          <button className={`map-tool-btn${showPinTree ? ' active' : ''}`} onClick={() => setShowPinTree((v) => !v)} title="Pin-Liste">ðŸ—‚</button>
        </div>
        <div className="map-toolbar__group">
          <GridControlsPanel
            settings={gridSettings}
            onChange={updateGridSettings}
            activeCellCount={cells.size}
            sessionId={sessionId}
            mapId={mapId}
            database={database}
            onClear={() => { void clearAllCells(database, sessionId, mapId).then(() => setCells(new Map())); }}
          />
        </div>
      </div>

      {/* Map canvas */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#111', cursor }}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onClick={handleMapClick}
      >
        {/* Zoom controls â€” top right overlay */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
          <button className="map-tool-btn" onClick={() => setScale((s) => Math.min(10, s * 1.25))} title="Zoom +">ï¼‹</button>
          <button className="map-tool-btn" onClick={() => setScale((s) => Math.max(0.1, s * 0.8))} title="Zoom âˆ’">ï¼</button>
          <button className="map-tool-btn" onClick={resetView} title="Reset">âŒ‚</button>
        </div>

        <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
          <img src={imgSrc} alt="Karte" draggable={false} style={{ display: 'block', maxWidth: 'none' }}
            onLoad={(e) => { const i = e.currentTarget; setImgSize({ w: i.naturalWidth, h: i.naturalHeight }); }}
          />
          {imgSize.w > 0 && (
            <GridOverlaySvg
              settings={gridSettings}
              imgW={imgSize.w} imgH={imgSize.h}
              cells={cells}
              gridMode={mode === 'grid'}
              sessionId={sessionId} mapId={mapId} database={database}
              onCellsChange={setCells}
              onCellContextMenu={handleCellContextMenu}
            />
          )}
          {markers.map((m) => {
            const geo = parsePinGeometry(m.geometry_json);
            return (
              <div key={m.id} className="map-pin"
                style={{
                  left: geo.x, top: geo.y,
                  fontSize: pinPx,
                  transform: `scale(${1 / scale}) translate(-50%, -100%)`,
                  transformOrigin: '50% 100%',
                }}
                onClick={(e) => openPinEditor(m, e)}
              >
                <span className="map-pin__icon">{getPinEmoji(m.style_json)}</span>
                {m.label_text && <span className="map-pin__label">{m.label_text}</span>}
              </div>
            );
          })}
        </div>

        {/* Ruler SVG overlay â€” outside transform, uses screen coords */}
        {mode === 'measure' && rulerP1 && (
          <RulerOverlay
            p1={rulerP1} p2={rulerP2}
            scale={scale} offset={offset}
            cellSize={gridSettings.cellSize}
            measureValue={gridSettings.measureValue}
            measureUnit={gridSettings.measureUnit}
            rulerColor={gridSettings.rulerColor}
            rulerOpacity={gridSettings.rulerOpacity}
            rulerWidth={gridSettings.rulerWidth}
          />
        )}

        {showCoordinates && coords && <div className="map-viewer__coords">{coords.x} Ã— {coords.y}</div>}
        {mode === 'pin' && <div className="map-viewer__hint">Klick auf Karte â†’ Pin setzen</div>}
        {mode === 'grid' && <div className="map-viewer__hint">Linksklick/halten: malen Â· Rechtsklick: Zustand Â· {cells.size} Zellen</div>}
        {mode === 'measure' && !rulerP1 && <div className="map-viewer__hint">Startpunkt klickenâ€¦</div>}
        {mode === 'measure' && rulerP1 && !rulerP2 && <div className="map-viewer__hint">Endpunkt klickenâ€¦</div>}
      </div>

      {/* Pin tree */}
      {showPinTree && (
        <PinTree
          markers={markers}
          editingId={editingPin?.id ?? null}
          onSelect={openPinEditor}
          onClose={() => setShowPinTree(false)}
          entities={entities}
          onGroupRename={handleGroupRename}
          onPinMove={(markerId, newGroup) => {
            void updateMarker(database, markerId, { group_name: newGroup }).then(reloadMarkers);
          }}
        />
      )}

      {/* Pin editor */}
      {editingPin && (
        <div className="map-pin-editor">
          <div className="map-pin-editor__header">
            <span>Pin bearbeiten</span>
            <button onClick={() => setEditingPin(null)}>âœ•</button>
          </div>
          <div className="map-pin-editor__body">
            <div className="pin-icon-picker">
              {PIN_ICONS.map((ic) => (
                <button key={ic.key}
                  className={`pin-icon-btn${editIcon === ic.key ? ' active' : ''}`}
                  title={ic.label}
                  onClick={() => setEditIcon(ic.key)}>
                  {ic.emoji}
                </button>
              ))}
            </div>
            <label className="map-pin-editor__label">Name</label>
            <input className="map-pin-editor__name-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
            <label className="map-pin-editor__label">Notizen</label>
            <textarea className="map-pin-editor__textarea" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
            <label className="map-pin-editor__label">Entity-Links</label>
            <div className="pin-entity-links">
              {/* primary entity */}
              {editEntityId && (() => {
                const en = entities.find((e) => e.id === editEntityId);
                return en ? (
                  <div className="pin-entity-chip">
                    <span className="pin-entity-chip__type">{en.type}</span>
                    <span className="pin-entity-chip__name">{en.title}</span>
                    <button className="pin-entity-chip__nav" title="Ã–ffnen" onClick={() => { onNavigateToEntity?.(en.id); setEditingPin(null); }}>â†’</button>
                    <button className="pin-entity-chip__del" title="Entfernen" onClick={() => setEditEntityId('')}>Ã—</button>
                  </div>
                ) : null;
              })()}
              {/* extra entities */}
              {editEntityIds.map((eid) => {
                const en = entities.find((e) => e.id === eid);
                if (!en) return null;
                return (
                  <div key={eid} className="pin-entity-chip">
                    <span className="pin-entity-chip__type">{en.type}</span>
                    <span className="pin-entity-chip__name">{en.title}</span>
                    <button className="pin-entity-chip__nav" title="Ã–ffnen" onClick={() => { onNavigateToEntity?.(eid); setEditingPin(null); }}>â†’</button>
                    <button className="pin-entity-chip__del" title="Entfernen" onClick={() => setEditEntityIds((prev) => prev.filter((x) => x !== eid))}>Ã—</button>
                  </div>
                );
              })}
              {showEntityPicker ? (
                <div className="pin-entity-add">
                  <select autoFocus className="pin-entity-add__select"
                    onChange={(e) => {
                      const id = e.target.value;
                      if (!id) return;
                      if (!editEntityId) { setEditEntityId(id); }
                      else if (!editEntityIds.includes(id)) { setEditEntityIds((prev) => [...prev, id]); }
                      setShowEntityPicker(false);
                    }}
                    onBlur={() => setShowEntityPicker(false)}
                    defaultValue="">
                    <option value="" disabled>â€” Entity auswÃ¤hlen â€”</option>
                    {entities
                      .filter((en) => en.id !== editEntityId && !editEntityIds.includes(en.id))
                      .map((en) => <option key={en.id} value={en.id}>{en.title} ({en.type})</option>)}
                  </select>
                </div>
              ) : (
                <button className="pin-entity-add-btn" onClick={() => setShowEntityPicker(true)}>+ Entity verlinken</button>
              )}
            </div>
          </div>
          <div className="map-pin-editor__footer">
            <button className="btn btn--primary" onClick={() => void savePin()}>Speichern</button>
            <button className="btn" style={{ color: 'var(--color-status-failure)' }} onClick={() => void deletePin(editingPin.id)}>LÃ¶schen</button>
          </div>
        </div>
      )}

      {/* Cell context menu â€” outside transform */}
      {cellMenu && (
        <CellContextMenu
          x={cellMenu.x} y={cellMenu.y}
          cellKey={cellMenu.cellKey}
          cellStates={gridSettings.cellStates}
          onPick={pickCellState}
          onClose={() => setCellMenu(null)}
        />
      )}
    </div>
  );
}

export default MapViewer;

