import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getMap, getAssetUrl, loadGridSettings, saveGridSettings } from '../services/map-service';
import { listLayers, updateLayer } from '../services/map-layer-service';
import { listTokens, createToken, moveToken, updateToken, setCounter, setStatusChips, deleteToken } from '../services/map-token-service';
import type { MapTokenRow } from '../services/map-token-service';
import { MapToken } from './MapTokenLayer';
import { TokenEditor, type TokenEditPatch } from './TokenEditor';
import type { MapLayerRow } from '../services/map-layer-service';
import { FogTools, type FogToolMode, type FogToolShape } from './FogTools';
import { FogMaskCanvas } from './FogMaskCanvas';
import type { DatabaseLike } from '../services/entity-service';
import { getMarkersForMap, createMarker, updateMarker, deleteMarker } from '../services/map-marker-service';
import type { MarkerRow } from '../services/map-marker-service';
import { getActivatedCells, clearAllCells, setCellState } from '../services/session-grid-service';
import { listEntitiesByType } from '../services/entity-service';
import { GridLayer, CellStateLayer, PaintInteractionLayer, GridControlsPanel, CellContextMenu, DEFAULT_GRID_SETTINGS } from './MapGrid';
import type { GridSettings } from './MapGrid';
import { listVars } from '../services/session-variable-service';
import type { VarRow } from '../services/session-variable-service';
import { ConditionBuilder } from './ConditionBuilder';
import type { VarDef } from './ConditionBuilder';

const VISIBILITY_OPTIONS: { key: string; label: string }[] = [
  { key: 'public', label: 'Öffentlich' },
  { key: 'gm_only', label: 'Nur DM' },
  { key: 'player_known', label: 'Für den Spieler (wenn Entity bekannt)' },
  { key: 'hidden_until_condition', label: 'Bedingung…' },
];

type Mode = 'navigate' | 'pin' | 'move-pin' | 'grid' | 'measure' | 'radius' | 'fog' | 'move-layer' | 'token';

const PIN_SIZE_PX: Record<string, number> = { S: 18, M: 26, L: 38 };

interface Props {
  mapId: string;
  sessionId?: string;
  database: DatabaseLike;
  showCoordinates?: boolean;
  onNavigateToEntity?: (entityId: string) => void;
  /** Fog layer currently selected for painting (from the LayerPanel). When set,
   *  the map enters fog-paint on that layer and shows the fog toolbar. */
  editFogLayerId?: string | null;
  /** Bumped by the parent to make the map reload its layers live (no remount). */
  reloadKey?: number;
  /** Notifies the parent that layers changed here (e.g. a fog stroke) so other
   *  views (LayerPanel) can refresh. */
  onLayersChanged?: () => void;
  /** Image layer currently in move mode (from the LayerPanel). When set, that
   *  layer is draggable on the map to reposition it. */
  moveLayerId?: string | null;
}

function parsePinGeometry(json: string): { x: number; y: number; notes?: string; condition?: unknown } {
  try { return JSON.parse(json) as { x: number; y: number; notes?: string; condition?: unknown }; } catch { return { x: 0, y: 0 }; }
}

const PIN_ICONS = [
  { key: 'pin',         emoji: '📍', label: 'Pin' },
  { key: 'danger',      emoji: '☠️', label: 'Gefahr' },
  { key: 'treasure',    emoji: '💰', label: 'Schatz' },
  { key: 'note',        emoji: '📝', label: 'Notiz' },
  { key: 'question',    emoji: '❓', label: 'Frage' },
  { key: 'exclamation', emoji: '❗', label: 'Wichtig' },
  { key: 'combat',      emoji: '⚔️', label: 'Kampf' },
  { key: 'mountain',    emoji: '🏔️', label: 'Berg' },
  { key: 'forest',      emoji: '🌲', label: 'Wald' },
  { key: 'cave',        emoji: '🕳️', label: 'Höhle' },
  { key: 'npc',         emoji: '👤', label: 'NPC/Person' },
  { key: 'shop',        emoji: '🛒', label: 'Händler' },
  { key: 'inn',         emoji: '🛏️', label: 'Taverne/Rast' },
  { key: 'town',        emoji: '🏘️', label: 'Stadt/Dorf' },
  { key: 'poi',         emoji: '⭐', label: 'Sehenswert' },
] as const;

type PinIconKey = typeof PIN_ICONS[number]['key'];

function getPinEmoji(styleJson: string): string {
  try {
    const s = JSON.parse(styleJson) as { icon?: string };
    return PIN_ICONS.find((i) => i.key === s.icon)?.emoji ?? '📍';
  } catch { return '📍'; }
}

// ── Pin Tree (nested folders via "/" in group_name) ──────────────────────────

interface TreeNode {
  path: string;          // full path, e.g. "Städte/Hauptstädte"
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
    if (m.kind === 'folder-anchor') {
      // ensures the folder node exists without adding a visible pin
      getNode((m.group_name ?? '').trim() || (m.label_text ?? ''));
      continue;
    }
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

function FolderNode({
  node, depth, collapsed, onToggle, editingId, onSelect, entities,
  renamingPath, renameVal, onRenameVal, onRenameCommit, onRenameStart, onRenameCancel,
  dropHighlight, dragSourcePath, onPointerDown,
}: {
  node: TreeNode; depth: number;
  collapsed: Set<string>; onToggle: (p: string) => void;
  editingId: string | null; onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  entities: { id: string; title: string }[];
  renamingPath: string | null; renameVal: string;
  onRenameVal: (v: string) => void; onRenameCommit: () => void;
  onRenameStart: (p: string) => void; onRenameCancel: () => void;
  dropHighlight: boolean;
  dragSourcePath: string | null;
  onPointerDown: (payload: DragPayload, label: string, e: React.PointerEvent) => void;
}) {
  const isOpen = !collapsed.has(node.path);
  const indent = depth * 14;
  const pinCount = node.pins.length + node.children.reduce((s, c) => s + c.pins.length, 0);

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
          <input className="map-pin-tree__rename-input" value={renameVal} autoFocus
            onChange={(e) => onRenameVal(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel(); }}
            onClick={(e) => e.stopPropagation()} />
        ) : (
          <span className="map-pin-tree__group-name"
            onDoubleClick={(e) => { e.stopPropagation(); onRenameStart(node.path); }}>
            📁 {node.name}
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
              dropHighlight={dropHighlight} dragSourcePath={dragSourcePath}
              onPointerDown={onPointerDown} />
          ))}
          {node.pins.map((m) => (
            <PinRow key={m.id} m={m} indent={indent + 14} editingId={editingId} onSelect={onSelect} entities={entities}
              onPointerDown={onPointerDown} />
          ))}
        </>
      )}
    </div>
  );
}

function PinRow({ m, indent, editingId, onSelect, entities, onPointerDown }: {
  m: MarkerRow; indent: number; editingId: string | null;
  onSelect: (m: MarkerRow, e: React.MouseEvent) => void;
  entities: { id: string; title: string }[];
  onPointerDown: (payload: DragPayload, label: string, e: React.PointerEvent) => void;
}) {
  const linked = entities.find((e) => e.id === m.entity_id);
  return (
    <div
      role="button"
      tabIndex={0}
      className={`map-pin-tree__item${editingId === m.id ? ' active' : ''}`}
      style={{ paddingLeft: 12 + indent, cursor: 'grab', userSelect: 'none' }}
      onClick={(e) => onSelect(m, e as unknown as React.MouseEvent)}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect(m, e as unknown as React.MouseEvent); }}
      onPointerDown={(e) => onPointerDown({ kind: 'pin', id: m.id }, m.label_text ?? '(kein Name)', e)}
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
  panelCollapsed: boolean;
  onTogglePanel: () => void;
  entities: { id: string; title: string }[];
  onGroupRename: (groupOld: string, groupNew: string) => void;
  onPinMove: (markerId: string, newGroup: string) => void;
  onCreateFolder: (name: string) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

type PointerDrag = {
  payload: DragPayload;
  label: string;
  ghostX: number;
  ghostY: number;
  dropPath: string | null; // null = no valid target, '' = root, 'a/b' = folder
};

function PinTree({ markers, editingId, onSelect, panelCollapsed, onTogglePanel, entities, onGroupRename, onPinMove, onCreateFolder, onResizeStart }: PinTreeProps) {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');
  const [newFolderInput, setNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [drag, setDrag] = useState<PointerDrag | null>(null);
  const dragRef = useRef<PointerDrag | null>(null);

  const q = search.toLowerCase();
  const filtered = q
    ? markers.filter((m) => (m.label_text ?? '').toLowerCase().includes(q) || (m.group_name ?? '').toLowerCase().includes(q))
    : markers;

  const { root, ungrouped } = buildTree(filtered);
  const allRoot = root;

  function toggleCollapse(path: string) {
    setCollapsed((prev) => { const n = new Set(prev); if (n.has(path)) n.delete(path); else n.add(path); return n; });
  }

  function commitRename() {
    if (renamingPath !== null) onGroupRename(renamingPath, renameVal.trim());
    setRenamingPath(null);
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (name) onCreateFolder(name);
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
        if (cur.payload.kind === 'pin') {
          onPinMove(cur.payload.id, cur.dropPath);
        } else {
          const folderName = cur.payload.path.split('/').pop()!;
          const newPath = cur.dropPath ? `${cur.dropPath}/${folderName}` : folderName;
          if (newPath !== cur.payload.path) onGroupRename(cur.payload.path, newPath);
        }
      }
      setDrag(null);
      dragRef.current = null;
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  if (panelCollapsed) {
    return (
      <div className="map-pin-tree map-pin-tree--collapsed">
        <div className="map-pin-tree__resize-handle" onMouseDown={onResizeStart} />
        <button className="map-pin-tree__collapse-btn" onClick={onTogglePanel} title="Pin-Liste aufklappen">
          <span className="map-pin-tree__collapsed-label">PINS</span>
        </button>
      </div>
    );
  }

  return (
    <div className="map-pin-tree">
      <div className="map-pin-tree__resize-handle" onMouseDown={onResizeStart} />
      <div className="map-pin-editor__header">
        <span>Pins ({markers.filter((m) => m.kind !== 'folder-anchor').length})</span>
        <button className="map-pin-tree__new-folder-btn" title="Neuer Ordner"
          onClick={() => setNewFolderInput(true)}>📁+</button>
        <button onClick={onTogglePanel} title="Einklappen">◀</button>
      </div>

      {newFolderInput && (
        <div className="map-pin-tree__new-folder-row">
          <input className="map-pin-tree__rename-input" autoFocus placeholder="Ordnername…"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setNewFolderInput(false); }}
          />
          <button onClick={createFolder} style={{ fontSize: '0.75rem' }}>✓</button>
          <button onClick={() => setNewFolderInput(false)} style={{ fontSize: '0.75rem' }}>✕</button>
        </div>
      )}

      <div className="map-pin-tree__search-wrap">
        <input className="map-pin-tree__search" placeholder="Suchen…" value={search}
          onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="map-pin-tree__list" data-drop-path="">
        {allRoot.length === 0 && ungrouped.length === 0 && (
          <div className="map-pin-tree__empty">Keine Pins. Pins auf der Karte setzen und hier per Drag in Ordner sortieren.</div>
        )}
        {ungrouped.map((m) => (
          <PinRow key={m.id} m={m} indent={0} editingId={editingId} onSelect={onSelect} entities={entities}
            onPointerDown={startDrag} />
        ))}
        {allRoot.map((node) => (
          <FolderNode key={node.path} node={node} depth={0}
            collapsed={collapsed} onToggle={toggleCollapse}
            editingId={editingId} onSelect={onSelect} entities={entities}
            renamingPath={renamingPath} renameVal={renameVal}
            onRenameVal={setRenameVal} onRenameCommit={commitRename}
            onRenameStart={(p) => { setRenamingPath(p); setRenameVal(p); }}
            onRenameCancel={() => setRenamingPath(null)}
            dropHighlight={drag?.dropPath === node.path}
            dragSourcePath={drag?.payload.kind === 'folder' ? drag.payload.path : null}
            onPointerDown={startDrag} />
        ))}
      </div>

      {/* Drag ghost */}
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

// ── Ruler overlay ─────────────────────────────────────────────────────────────

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

function RadiusOverlay({
  center, edge, scale, offset, cellSize, measureValue, measureUnit, rulerColor, rulerOpacity, rulerWidth,
}: {
  center: RulerPoint; edge: RulerPoint | null;
  scale: number; offset: { x: number; y: number };
  cellSize: number; measureValue: number; measureUnit: string;
  rulerColor: string; rulerOpacity: number; rulerWidth: number;
}) {
  if (!edge) return null;
  const cx = center.x * scale + offset.x;
  const cy = center.y * scale + offset.y;
  const ex = edge.x * scale + offset.x;
  const ey = edge.y * scale + offset.y;
  const r = Math.sqrt((ex - cx) ** 2 + (ey - cy) ** 2);
  const pixelDist = Math.sqrt((edge.x - center.x) ** 2 + (edge.y - center.y) ** 2);
  const realDist = (pixelDist / cellSize) * measureValue;
  const label = `r = ${realDist.toFixed(2)} ${measureUnit}`;
  const labelW = label.length * 7 + 16;
  return (
    <svg style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible", zIndex: 8 }}>
      <circle cx={cx} cy={cy} r={r}
        fill={rulerColor} fillOpacity={rulerOpacity * 0.3} stroke={rulerColor} strokeWidth={rulerWidth} strokeOpacity={rulerOpacity} strokeDasharray="6 3" />
      <circle cx={cx} cy={cy} r={rulerWidth + 3} fill={rulerColor} fillOpacity={rulerOpacity} />
      <line x1={cx} y1={cy} x2={ex} y2={ey}
        stroke={rulerColor} strokeWidth={rulerWidth * 0.6} strokeOpacity={rulerOpacity * 0.6} strokeDasharray="4 4" />
      <rect x={cx - labelW / 2} y={cy - r - 22} width={labelW} height={20} rx={4} fill="rgba(0,0,0,0.75)" />
      <text x={cx} y={cy - r - 6} textAnchor="middle" fill={rulerColor} fillOpacity={rulerOpacity} fontSize={12} fontFamily="monospace">{label}</text>
    </svg>
  );
}

export function MapViewer({ mapId, sessionId = 'default', database, showCoordinates, onNavigateToEntity, editFogLayerId = null, reloadKey = 0, onLayersChanged, moveLayerId = null }: Props) {
  const { t } = useTranslation('map');
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [imageLayers, setImageLayers] = useState<MapLayerRow[]>([]);
  const [fogLayers, setFogLayers] = useState<MapLayerRow[]>([]);
  const [fogBrush, setFogBrush] = useState(40);
  const [fogFeather, setFogFeather] = useState(8);
  const [fogMode, setFogMode] = useState<FogToolMode>('reveal');
  const [fogShape, setFogShape] = useState<FogToolShape>('brush');
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [markers, setMarkers] = useState<MarkerRow[]>([]);
  const [tokens, setTokens] = useState<MapTokenRow[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [editingToken, setEditingToken] = useState<MapTokenRow | null>(null);
  const [cells, setCells] = useState<Map<string, number>>(new Map());
  const [gridSettings, setGridSettings] = useState<GridSettings>(DEFAULT_GRID_SETTINGS);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [mode, setMode] = useState<Mode>('navigate');
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
  const [editingPin, setEditingPin] = useState<MarkerRow | null>(null);
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const [movingPinId, setMovingPinId] = useState<string | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editEntityId, setEditEntityId] = useState('');
  const [editEntityIds, setEditEntityIds] = useState<string[]>([]);
  const [showEntityPicker, setShowEntityPicker] = useState(false);
  const [editIcon, setEditIcon] = useState<PinIconKey>('pin');
  const [editVisibility, setEditVisibility] = useState('public');
  const [editCondition, setEditCondition] = useState<unknown>(null);
  const [sessionVarsRaw, setSessionVarsRaw] = useState<VarRow[]>([]);
  const [entities, setEntities] = useState<{ id: string; type: string; title: string }[]>([]);
  const [pinTreeCollapsed, setPinTreeCollapsed] = useState(false);
  const [pinTreeWidth, setPinTreeWidth] = useState(220);
  const [cellMenu, setCellMenu] = useState<{ x: number; y: number; cellKey: string } | null>(null);
  const [rulerP1, setRulerP1] = useState<RulerPoint | null>(null);
  const [rulerP2, setRulerP2] = useState<RulerPoint | null>(null);
  const [lastMeasureTool, setLastMeasureTool] = useState<'measure' | 'radius'>('measure');
  const [measureFlyout, setMeasureFlyout] = useState(false);
  const [activeCellStateId, setActiveCellStateId] = useState(1);
  const [gridFlyout, setGridFlyout] = useState(false);
  const [gridFlyoutPos, setGridFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const gridBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!measureFlyout) return;
    const close = () => setMeasureFlyout(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [measureFlyout]);

  useEffect(() => {
    if (!gridFlyout) return;
    const close = () => setGridFlyout(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [gridFlyout]);

  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const layerDrag = useRef<{ mx: number; my: number; ox: number; oy: number; last: { x: number; y: number } } | null>(null);
  const tokenDrag = useRef<{ id: string; moved: boolean } | null>(null);
  const suppressTokenClick = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureBtnRef = useRef<HTMLButtonElement>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const pinResizeStartX = useRef<number | null>(null);
  const pinResizeStartW = useRef<number>(220);

  function handlePinResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    pinResizeStartX.current = e.clientX;
    pinResizeStartW.current = pinTreeWidth;
    const onMove = (ev: MouseEvent) => {
      const delta = pinResizeStartX.current! - ev.clientX;
      setPinTreeWidth(Math.max(140, Math.min(500, pinResizeStartW.current + delta)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function reloadMarkers() {
    getMarkersForMap(database, mapId).then(setMarkers).catch(console.error);
  }

  function reloadTokens() {
    listTokens(database, mapId, sessionId).then(setTokens).catch(console.error);
  }

  function reloadLayers() {
    listLayers(database, mapId).then((layers) => {
      const visibleImages = layers
        .filter((l) => l.layer_type === 'image' && l.visible)
        .sort((a, b) => a.z_order - b.z_order);
      setImageLayers(visibleImages);
      setImgSrc(visibleImages[0]?.asset_id ? getAssetUrl(visibleImages[0].asset_id) : null);
      setFogLayers(layers
        .filter((l) => l.layer_type === 'fog' && l.visible)
        .sort((a, b) => a.z_order - b.z_order));
    }).catch(console.error);
  }

  // Layers reload on their own signal (reloadKey) so opacity/visibility/add
  // changes made in the LayerPanel show up live here without a remount.
  useEffect(() => {
    reloadLayers();
  }, [database, mapId, reloadKey]);

  useEffect(() => {
    getMap(database, mapId).then((m) => {
      if (!m) return;
      if (m.image_width_px) setImgSize({ w: m.image_width_px, h: m.image_height_px });
    }).catch(console.error);
    reloadMarkers();
    reloadTokens();
    getActivatedCells(database, sessionId, mapId)
      .then((rows) => setCells(new Map(rows.map((r) => [r.cell_key, r.state]))))
      .catch(console.error);
    listEntitiesByType({ database, type: null })
      .then((rows) => setEntities(rows as typeof entities))
      .catch(console.error);
    loadGridSettings(database, mapId).then((saved) => {
      if (saved) setGridSettings((prev) => ({ ...prev, ...saved } as GridSettings));
    }).catch(console.error);
    listVars(database, sessionId).then(setSessionVarsRaw).catch(console.error);
  }, [database, mapId, sessionId]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && mode === 'move-pin') {
        setMovingPinId(null);
        setSelectedPinId(null);
        setMode('navigate');
      }
      if (e.key === 'Escape') setSelectedPinId(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'pin' && mode !== 'move-pin') setGhostPos(null);
  }, [mode]);

  // Selecting a fog layer to edit (from the LayerPanel) puts the map into
  // fog-paint mode; clearing the selection returns to navigate.
  useEffect(() => {
    setMode((m) => (editFogLayerId ? 'fog' : m === 'fog' ? 'navigate' : m));
  }, [editFogLayerId]);

  function handleFogStrokeEnd(layerId: string, maskDataUrl: string) {
    setFogLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, mask_data: maskDataUrl } : l)));
    updateLayer(database, layerId, { mask_data: maskDataUrl }).then(() => onLayersChanged?.()).catch(console.error);
  }

  // Selecting an image layer to move (from the LayerPanel) puts the map into
  // move-layer mode; clearing the selection returns to navigate.
  useEffect(() => {
    setMode((m) => (moveLayerId ? 'move-layer' : m === 'move-layer' ? 'navigate' : m));
  }, [moveLayerId]);

  function handleLayerDragStart(layer: MapLayerRow, e: React.PointerEvent<HTMLImageElement>) {
    e.stopPropagation();
    layerDrag.current = { mx: e.clientX, my: e.clientY, ox: layer.offset_x, oy: layer.offset_y, last: { x: layer.offset_x, y: layer.offset_y } };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function handleLayerDragMove(layerId: string, e: React.PointerEvent<HTMLImageElement>) {
    const d = layerDrag.current;
    if (!d) return;
    const nx = d.ox + (e.clientX - d.mx) / scale;
    const ny = d.oy + (e.clientY - d.my) / scale;
    d.last = { x: nx, y: ny };
    setImageLayers((prev) => prev.map((l) => (l.id === layerId ? { ...l, offset_x: nx, offset_y: ny } : l)));
  }

  function handleLayerDragEnd(layerId: string) {
    const d = layerDrag.current;
    layerDrag.current = null;
    if (!d) return;
    updateLayer(database, layerId, { offset_x: Math.round(d.last.x), offset_y: Math.round(d.last.y) })
      .then(() => onLayersChanged?.())
      .catch(console.error);
  }

  // NOTE: onWheel as React synthetic handler works in Tauri (no outer scroll container).
  // A web port would need addEventListener({ passive: false }) on containerRef instead.
  function handleWheel(e: React.WheelEvent) {
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
  }

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
    if ((mode === 'measure' || mode === 'radius') && rulerP1) {
      setRulerP2(toMapCoords(e.clientX, e.clientY));
    }
    if (mode === 'pin' || mode === 'move-pin') {
      setGhostPos(toMapCoords(e.clientX, e.clientY));
    }
    if (showCoordinates && containerRef.current) {
      const { x, y } = toMapCoords(e.clientX, e.clientY);
      setCoords({ x: Math.round(x), y: Math.round(y) });
    }
  }

  function handleMouseUp() { setDragging(false); dragStart.current = null; }

  // Direct token drag: pointer down on a token, move, up -> persist via moveToken.
  function handleTokenPointerDown(token: MapTokenRow, e: React.PointerEvent<HTMLDivElement>) {
    if (mode !== 'navigate') return;
    e.stopPropagation();
    tokenDrag.current = { id: token.id, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function handleTokenPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!tokenDrag.current) return;
    tokenDrag.current.moved = true;
    const { x, y } = toMapCoords(e.clientX, e.clientY);
    const id = tokenDrag.current.id;
    setTokens((prev) => prev.map((tk) => (tk.id === id ? { ...tk, x, y } : tk)));
  }

  function handleTokenPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!tokenDrag.current) return;
    const { id, moved } = tokenDrag.current;
    tokenDrag.current = null;
    if (!moved) return; // a plain click — selection handled in onClick
    suppressTokenClick.current = true; // swallow the click that follows a drag
    const { x, y } = toMapCoords(e.clientX, e.clientY);
    moveToken(database, id, Math.round(x), Math.round(y)).then(reloadTokens).catch(console.error);
  }

  function handleTokenClick(token: MapTokenRow, e: React.MouseEvent<HTMLDivElement>) {
    e.stopPropagation();
    if (suppressTokenClick.current) { suppressTokenClick.current = false; return; }
    if (mode !== 'navigate') return;
    setSelectedTokenId(token.id);
    setEditingToken(token);
  }

  async function saveTokenEdit(patch: TokenEditPatch) {
    if (!editingToken) return;
    const id = editingToken.id;
    await updateToken(database, id, { label: patch.label, ring_color: patch.ring_color, entity_id: patch.entity_id });
    await setCounter(database, id, { counter_label: patch.counter_label, counter_value: patch.counter_value });
    await setStatusChips(database, id, patch.status_chips);
    setEditingToken(null);
    reloadTokens();
    onLayersChanged?.();
  }

  async function deleteEditingToken() {
    if (!editingToken) return;
    const id = editingToken.id;
    setEditingToken(null);
    setSelectedTokenId((cur) => (cur === id ? null : cur));
    await deleteToken(database, id);
    reloadTokens();
  }

  async function handleMapClick(e: React.MouseEvent) {
    if (!containerRef.current) return;
    const pos = toMapCoords(e.clientX, e.clientY);
    if (mode === 'navigate') { setSelectedPinId(null); }

    if (mode === 'move-pin' && movingPinId) {
      const pin = markers.find((m) => m.id === movingPinId);
      if (pin) {
        const geo = parsePinGeometry(pin.geometry_json);
        await updateMarker(database, movingPinId, {
          geometry_json: JSON.stringify({ ...geo, x: Math.round(pos.x), y: Math.round(pos.y) }),
        });
        reloadMarkers();
      }
      setMovingPinId(null);
      setSelectedPinId(null);
      setMode('navigate');
      return;
    }

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

    if (mode === 'token') {
      // Ad-hoc token as base placement (session_id NULL); entity link set later
      // in the editor. Token layer is auto-created by the service on first use.
      const { id } = await createToken(database, { map_id: mapId, x: Math.round(pos.x), y: Math.round(pos.y) });
      setMode('navigate');
      const list = await listTokens(database, mapId, sessionId);
      setTokens(list);
      const created = list.find((tk) => tk.id === id) ?? null;
      setSelectedTokenId(id);
      setEditingToken(created);
      onLayersChanged?.();
      return;
    }

    if (mode === 'measure' || mode === 'radius') {
      if (!rulerP1) {
        setRulerP1(pos);
        setRulerP2(null);
      } else {
        setRulerP2(pos);
        setRulerP1(null);
      }
    }
  }

  function openPinEditor(m: MarkerRow, e: React.MouseEvent) {
    e.stopPropagation();
    if (mode === 'grid') return;
    if (mode === 'move-pin') return; // move-pin handled by map click
    const geo = parsePinGeometry(m.geometry_json);
    setEditingPin(m);
    setEditLabel(m.label_text ?? '');
    setEditNotes(geo.notes ?? '');
    setEditEntityId(m.entity_id ?? '');
    try {
      const s = JSON.parse(m.style_json) as { icon?: string; extra_entity_ids?: string[] };
      setEditIcon((s.icon as PinIconKey) ?? 'pin');
      setEditEntityIds(Array.isArray(s.extra_entity_ids) ? s.extra_entity_ids : []);
    } catch { setEditIcon('pin'); setEditEntityIds([]); }
    try {
      const vis = JSON.parse(m.visibility_json);
      if (typeof vis === 'string') { setEditVisibility(vis); setEditCondition(null); }
      else { setEditVisibility((vis as { scope: string }).scope ?? 'public'); setEditCondition((vis as { condition?: unknown }).condition ?? null); }
    } catch { setEditVisibility('public'); setEditCondition(null); }
  }

  async function savePin() {
    if (!editingPin) return;
    const geo = parsePinGeometry(editingPin.geometry_json);
    await updateMarker(database, editingPin.id, {
      label_text: editLabel,
      entity_id: editEntityId || null,
      geometry_json: JSON.stringify({ ...geo, notes: editNotes }),
      style_json: JSON.stringify({ icon: editIcon, extra_entity_ids: editEntityIds }),
      visibility_json: JSON.stringify(
        editVisibility === 'hidden_until_condition'
          ? { scope: editVisibility, condition: editCondition }
          : editVisibility
      ),
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
    // rename group_name on all markers (pins + folder-anchors) with exact or child path match
    const toRename = markers.filter((m) => {
      const g = m.group_name ?? '';
      return g === groupOld || g.startsWith(groupOld + '/');
    });
    // also rename folder-anchor whose label_text matches (top-level anchor path)
    const anchorRename = markers.filter((m) =>
      m.kind === 'folder-anchor' && (m.label_text === groupOld || (m.label_text ?? '').startsWith(groupOld + '/'))
    );
    const all = [...new Set([...toRename, ...anchorRename])];
    await Promise.all(all.map((m) => {
      const newGroup = (m.group_name ?? '').replace(groupOld, groupNew);
      const newLabel = m.kind === 'folder-anchor' ? (m.label_text ?? '').replace(groupOld, groupNew) : m.label_text ?? '';
      return updateMarker(database, m.id, {
        group_name: newGroup,
        ...(m.kind === 'folder-anchor' ? { label_text: newLabel } : {}),
      });
    }));
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

  const pinPx = PIN_SIZE_PX[gridSettings.pinSize] ?? 26;
  const VALID_VAR_TYPES = new Set(['boolean', 'number', 'string', 'enum']);
  const sessionVarDefs: VarDef[] = sessionVarsRaw
    .filter((v) => VALID_VAR_TYPES.has(v.type))
    .map((v) => ({ id: v.id, label: v.label, type: v.type as VarDef['type'] }));
  const cursor = (mode === 'pin' || mode === 'token') ? 'crosshair' : mode === 'grid' ? 'cell' : (mode === 'measure' || mode === 'radius' || mode === 'fog') ? 'crosshair' : mode === 'move-layer' ? 'move' : dragging ? 'grabbing' : 'grab';

  if (!imgSrc) return <div className="map-empty">Kein Kartenbild — Karte importieren um zu beginnen.</div>;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left toolbar */}
      <div className="map-toolbar">
        <div className="map-toolbar__group">
          <button className={`map-tool-btn${mode === 'navigate' ? ' active' : ''}`} onClick={() => setMode('navigate')} title={t('all')}>🗺</button>
          <button className={`map-tool-btn${mode === 'pin' ? ' active' : ''}`} onClick={() => setMode('pin')} title="Pin setzen">📍</button>
          <button className={`map-tool-btn${mode === 'token' ? ' active' : ''}`} onClick={() => setMode('token')} title={t('token.place', 'Token setzen')}>🧙</button>
          {/* Grid paint tool group — flyout with cell states */}
          <div className="map-tool-group" style={{ position: 'relative' }}>
            {(() => {
              const activeState = gridSettings.cellStates.find((s) => s.id === activeCellStateId) ?? gridSettings.cellStates[0];
              return (
                <button
                  ref={gridBtnRef}
                  className={`map-tool-btn${mode === 'grid' ? ' active' : ''}`}
                  title="Grid malen"
                  onClick={() => {
                    setMode((m) => m === 'grid' ? 'navigate' : 'grid');
                    const rect = gridBtnRef.current?.getBoundingClientRect();
                    if (rect) setGridFlyoutPos({ top: rect.top, left: rect.right + 4 });
                    setGridFlyout((v) => !v);
                  }}
                >
                  {activeCellStateId === 0
                    ? '🧹'
                    : activeState
                      ? <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 2, background: activeState.color, border: '1px solid rgba(255,255,255,0.3)', verticalAlign: 'middle' }} />
                      : '⬜'}
                  <span className="map-tool-group__arrow">▸</span>
                </button>
              );
            })()}
            {gridFlyout && gridFlyoutPos && (
              <div className="map-tool-flyout" style={{ top: gridFlyoutPos.top, left: gridFlyoutPos.left }} onMouseDown={(e) => e.stopPropagation()}>
                <button
                  className={`map-tool-flyout__item${activeCellStateId === 0 ? ' active' : ''}`}
                  onClick={() => { setActiveCellStateId(0); setMode('grid'); setGridFlyout(false); }}
                >
                  <span className="map-tool-flyout__icon">🧹</span>
                  <span className="map-tool-flyout__label">Radiergummi</span>
                </button>
                <div style={{ borderTop: '1px solid var(--color-border)', margin: '3px 0' }} />
                {gridSettings.cellStates.map((st) => (
                  <button key={st.id}
                    className={`map-tool-flyout__item${activeCellStateId === st.id ? ' active' : ''}`}
                    onClick={() => { setActiveCellStateId(st.id); setMode('grid'); setGridFlyout(false); }}
                  >
                    <span className="map-tool-flyout__icon">
                      <span style={{ display: 'inline-block', width: 14, height: 14, borderRadius: 2, background: st.color, border: '1px solid rgba(255,255,255,0.3)' }} />
                    </span>
                    <span className="map-tool-flyout__label">{st.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Measure tool group — PS-style flyout */}
          <div className="map-tool-group" style={{ position: 'relative' }}>
            <button
              ref={measureBtnRef}
              className={`map-tool-btn${(mode === 'measure' || mode === 'radius') ? ' active' : ''}`}
              title="Messwerkzeuge"
              onClick={() => {
                const rect = measureBtnRef.current?.getBoundingClientRect();
                if (rect) setFlyoutPos({ top: rect.top, left: rect.right + 4 });
                setMeasureFlyout((v) => !v);
              }}
            >
              {lastMeasureTool === 'measure' ? '📏' : '⭕'}
              <span className="map-tool-group__arrow">▸</span>
            </button>
            {measureFlyout && flyoutPos && (
              <div className="map-tool-flyout" style={{ top: flyoutPos.top, left: flyoutPos.left }} onMouseDown={(e) => e.stopPropagation()}>
                {([
                  { key: 'measure' as const, icon: '📏', label: 'Lineal' },
                  { key: 'radius'  as const, icon: '⭕', label: 'Radius' },
                ] as const).map((t) => (
                  <button key={t.key}
                    className={`map-tool-flyout__item${mode === t.key ? ' active' : ''}`}
                    onClick={() => { setMode(t.key); setLastMeasureTool(t.key); setRulerP1(null); setRulerP2(null); setMeasureFlyout(false); }}
                  >
                    <span className="map-tool-flyout__icon">{t.icon}</span>
                    <span className="map-tool-flyout__label">{t.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
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
        data-map-canvas
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMapClick}
      >
        {/* Zoom controls — top right overlay */}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 10 }}>
          <button className="map-tool-btn" onClick={() => setScale((s) => Math.min(10, s * 1.25))} title="Zoom +">＋</button>
          <button className="map-tool-btn" onClick={() => setScale((s) => Math.max(0.1, s * 0.8))} title="Zoom −">-</button>
          <button className="map-tool-btn" onClick={resetView} title="Reset">⌂</button>
        </div>

        {/* Fog paint toolbar — only while the selected fog layer still exists
            (guards against the layer being deleted mid-paint). */}
        {editFogLayerId && fogLayers.some((l) => l.id === editFogLayerId) && (
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10 }}>
            <FogTools
              brushSize={fogBrush} feather={fogFeather} mode={fogMode} shape={fogShape}
              onBrushSizeChange={setFogBrush} onFeatherChange={setFogFeather}
              onModeChange={setFogMode} onShapeChange={setFogShape}
            />
          </div>
        )}

        <div style={{ position: 'absolute', top: 0, left: 0, transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
          {imageLayers.map((layer, idx) => {
            const moving = moveLayerId === layer.id;
            return (
              <img
                key={layer.id}
                data-layer-id={layer.id}
                src={getAssetUrl(layer.asset_id ?? '')}
                alt={layer.name || 'Karte'}
                draggable={false}
                style={{
                  display: 'block',
                  maxWidth: 'none',
                  opacity: layer.opacity,
                  position: 'absolute',
                  left: layer.offset_x,
                  top: layer.offset_y,
                  pointerEvents: moving ? 'auto' : 'none',
                  cursor: moving ? 'move' : undefined,
                  outline: moving ? '2px dashed var(--color-accent)' : undefined,
                }}
                onLoad={idx === 0 ? (e) => { const i = e.currentTarget; setImgSize({ w: i.naturalWidth, h: i.naturalHeight }); } : undefined}
                onPointerDown={moving ? (e) => handleLayerDragStart(layer, e) : undefined}
                onPointerMove={moving ? (e) => handleLayerDragMove(layer.id, e) : undefined}
                onPointerUp={moving ? () => handleLayerDragEnd(layer.id) : undefined}
              />
            );
          })}
          {imgSize.w > 0 && fogLayers.map((layer) => (
            // DM editing view dims fog to ~half so the map stays visible while
            // painting; the mask itself is full coverage (players see it opaque
            // via the player-map export path).
            <div key={layer.id} style={{ position: 'absolute', top: 0, left: 0, opacity: layer.opacity * 0.5 }}>
              <FogMaskCanvas
                layerId={layer.id}
                maskData={layer.mask_data}
                imgW={imgSize.w}
                imgH={imgSize.h}
                mode={fogMode}
                shape={fogShape}
                brushSize={fogBrush}
                feather={fogFeather}
                active={editFogLayerId === layer.id}
                onStrokeEnd={(m) => handleFogStrokeEnd(layer.id, m)}
              />
            </div>
          ))}
          {imgSize.w > 0 && gridSettings.visible && (
            <GridLayer
              imgW={imgSize.w} imgH={imgSize.h}
              cellSize={gridSettings.cellSize} type={gridSettings.type}
              lineColor={gridSettings.lineColor} lineOpacity={gridSettings.lineOpacity}
              lineWidth={gridSettings.lineWidth} lineDash={gridSettings.lineDash}
            />
          )}
          {imgSize.w > 0 && (
            <CellStateLayer
              imgW={imgSize.w} imgH={imgSize.h}
              cellSize={gridSettings.cellSize} type={gridSettings.type}
              cells={cells} cellStates={gridSettings.cellStates}
            />
          )}
          {imgSize.w > 0 && (
            <PaintInteractionLayer
              imgW={imgSize.w} imgH={imgSize.h}
              cellSize={gridSettings.cellSize} type={gridSettings.type}
              active={mode === 'grid'}
              activeCellStateId={activeCellStateId}
              cells={cells}
              sessionId={sessionId} mapId={mapId} database={database}
              onCellsChange={setCells}
              onCellContextMenu={handleCellContextMenu}
            />
          )}
          {markers.filter((m) => m.kind !== 'folder-anchor').map((m) => {
            const geo = parsePinGeometry(m.geometry_json);
            const isSelected = selectedPinId === m.id;
            const isMoving = movingPinId === m.id;
            let visScope = 'public';
            try { visScope = JSON.parse(m.visibility_json) as string; } catch { /* default public */ }
            return (
              <div key={m.id}
                className={`map-pin${isSelected ? ' map-pin--selected' : ''}${isMoving ? ' map-pin--moving' : ''}`}
                style={{
                  left: geo.x, top: geo.y,
                  fontSize: pinPx,
                  transform: `scale(${1 / scale}) translate(-50%, -100%)`,
                  transformOrigin: '50% 100%',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (mode === 'grid' || mode === 'move-pin') return;
                  if (isSelected) {
                    setSelectedPinId(null);
                    openPinEditor(m, e);
                  } else {
                    setSelectedPinId(m.id);
                    setEditingPin(null);
                  }
                }}
              >
                <span className="map-pin__icon">{getPinEmoji(m.style_json)}</span>
                {visScope === 'gm_only' && <span className="map-pin__vis-badge" title="Nur DM">🔒</span>}
                {visScope === 'hidden_until_condition' && <span className="map-pin__vis-badge" title="Bedingung">⏳</span>}
                {visScope === 'player_known' && <span className="map-pin__vis-badge" title="Für den Spieler (wenn bekannt)">👁</span>}
                {m.label_text && <span className="map-pin__label">{m.label_text}</span>}
                {isSelected && (
                  <button className="map-pin__move-btn" title="Pin verschieben"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMovingPinId(m.id);
                      setMode('move-pin');
                    }}>
                    ✥
                  </button>
                )}
              </div>
            );
          })}

          {tokens.map((tk) => (
            <MapToken
              key={tk.id}
              token={tk}
              entityTitle={entities.find((ent) => ent.id === tk.entity_id)?.title}
              scale={scale}
              selected={selectedTokenId === tk.id}
              onPointerDown={(e) => handleTokenPointerDown(tk, e)}
              onPointerMove={handleTokenPointerMove}
              onPointerUp={handleTokenPointerUp}
              onSelect={(e) => handleTokenClick(tk, e)}
            />
          ))}

          {ghostPos && (mode === 'pin' || (mode === 'move-pin' && movingPinId)) && (
            <div className="map-pin map-pin--ghost"
              style={{
                left: ghostPos.x, top: ghostPos.y,
                fontSize: pinPx,
                transform: `scale(${1 / scale}) translate(-50%, -100%)`,
                transformOrigin: '50% 100%',
              }}
            >
              <span className="map-pin__icon">
                {mode === 'move-pin'
                  ? getPinEmoji(markers.find((m) => m.id === movingPinId)?.style_json ?? '{}')
                  : '📍'}
              </span>
            </div>
          )}
        </div>

        {/* Ruler SVG overlay — outside transform, uses screen coords */}
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

        {/* Radius SVG overlay */}
        {mode === 'radius' && rulerP1 && (
          <RadiusOverlay
            center={rulerP1} edge={rulerP2}
            scale={scale} offset={offset}
            cellSize={gridSettings.cellSize}
            measureValue={gridSettings.measureValue}
            measureUnit={gridSettings.measureUnit}
            rulerColor={gridSettings.rulerColor}
            rulerOpacity={gridSettings.rulerOpacity}
            rulerWidth={gridSettings.rulerWidth}
          />
        )}

        {showCoordinates && coords && <div className="map-viewer__coords">{coords.x} × {coords.y}</div>}
        {mode === 'pin' && <div className="map-viewer__hint">Klick auf Karte → Pin setzen</div>}
        {mode === 'token' && <div className="map-viewer__hint">{t('token.placeHint', 'Klick auf Karte → Token setzen')}</div>}
        {mode === 'move-pin' && <div className="map-viewer__hint">Klick auf Karte → Pin hierhin verschieben · ESC abbrechen</div>}
        {mode === 'grid' && <div className="map-viewer__hint">Linksklick/halten: malen · Rechtsklick: Zustand · {cells.size} Zellen</div>}
        {mode === 'measure' && !rulerP1 && <div className="map-viewer__hint">Startpunkt klicken…</div>}
        {mode === 'measure' && rulerP1 && !rulerP2 && <div className="map-viewer__hint">Endpunkt klicken…</div>}
        {mode === 'radius' && !rulerP1 && <div className="map-viewer__hint">Mittelpunkt klicken…</div>}
        {mode === 'radius' && rulerP1 && !rulerP2 && <div className="map-viewer__hint">Radius ziehen…</div>}
      </div>

      {/* Pin tree — always visible, resizable */}
      <div style={{ width: pinTreeCollapsed ? 32 : pinTreeWidth, flexShrink: 0, position: 'relative' }}>
        <PinTree
          markers={markers}
          editingId={editingPin?.id ?? null}
          onSelect={openPinEditor}
          panelCollapsed={pinTreeCollapsed}
          onTogglePanel={() => setPinTreeCollapsed((v) => !v)}
          entities={entities}
          onGroupRename={handleGroupRename}
          onPinMove={(markerId, newGroup) => {
            void updateMarker(database, markerId, { group_name: newGroup }).then(reloadMarkers);
          }}
          onCreateFolder={(name) => {
            void createMarker(database, {
              map_id: mapId, kind: 'folder-anchor', label_text: name,
              group_name: name, entity_id: null,
              geometry_json: '{"virtual":true}',
              elevation_value: null, elevation_unit: null,
              visibility_json: '"public"', style_json: '{}',
            }).then(reloadMarkers);
          }}
          onResizeStart={handlePinResizeStart}
        />
      </div>

      {/* Pin editor */}
      {editingPin && (
        <div className="map-pin-editor">
          <div className="map-pin-editor__header">
            <span>Pin bearbeiten</span>
            <button onClick={() => setEditingPin(null)}>✕</button>
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
            <label className="map-pin-editor__label">Sichtbarkeit</label>
            <select className="map-pin-editor__name-input" value={editVisibility}
              onChange={(e) => setEditVisibility(e.target.value)}>
              {VISIBILITY_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {editVisibility === 'hidden_until_condition' && (
              <ConditionBuilder variables={sessionVarDefs} initialCondition={editCondition}
                onChange={setEditCondition} />
            )}
            <label className="map-pin-editor__label">Entity-Links</label>
            <div className="pin-entity-links">
              {/* primary entity */}
              {editEntityId && (() => {
                const en = entities.find((e) => e.id === editEntityId);
                return en ? (
                  <div className="pin-entity-chip">
                    <span className="pin-entity-chip__type">{en.type}</span>
                    <span className="pin-entity-chip__name">{en.title}</span>
                    <button className="pin-entity-chip__nav" title="Öffnen" onClick={() => { onNavigateToEntity?.(en.id); setEditingPin(null); }}>→</button>
                    <button className="pin-entity-chip__del" title="Entfernen" onClick={() => setEditEntityId('')}>×</button>
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
                    <button className="pin-entity-chip__nav" title="Öffnen" onClick={() => { onNavigateToEntity?.(eid); setEditingPin(null); }}>→</button>
                    <button className="pin-entity-chip__del" title="Entfernen" onClick={() => setEditEntityIds((prev) => prev.filter((x) => x !== eid))}>×</button>
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
                    <option value="" disabled>— Entity auswählen —</option>
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
            <button className="btn" style={{ color: 'var(--color-status-failure)' }} onClick={() => void deletePin(editingPin.id)}>Löschen</button>
          </div>
        </div>
      )}

      {/* Token editor — rendered panel (AP-003: no prompt/alert/confirm) */}
      {editingToken && (
        <TokenEditor
          token={editingToken}
          entities={entities}
          onSave={(patch) => void saveTokenEdit(patch)}
          onDelete={() => void deleteEditingToken()}
          onClose={() => setEditingToken(null)}
        />
      )}

      {/* Cell context menu — outside transform */}
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

