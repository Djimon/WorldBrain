import { useState, useCallback, useRef } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getActivatedCells, setCellState, clearAllCells } from '../services/session-grid-service';

export interface CellState {
  id: number;
  name: string;
  color: string;
}

export interface GridSettings {
  visible: boolean;
  type: 'square' | 'hex-flat' | 'hex-pointy';
  cellSize: number;
  lineColor: string;
  lineOpacity: number;
  lineWidth: number;
  lineDash: 'solid' | 'dashed' | 'dotted';
  snapping: boolean;
  cellStates: CellState[];
  measureValue: number;
  measureUnit: string;
  pinSize: 'S' | 'M' | 'L';
  rulerColor: string;
  rulerOpacity: number;
  rulerWidth: number;
}

export const DEFAULT_GRID_SETTINGS: GridSettings = {
  visible: true,
  type: 'square',
  cellSize: 40,
  lineColor: '#ffffff',
  lineOpacity: 0.3,
  lineWidth: 1,
  lineDash: 'solid',
  snapping: true,
  cellStates: [
    { id: 1, name: 'Besucht',    color: '#4a9eff' },
    { id: 2, name: 'Gefährlich', color: '#ff4a4a' },
    { id: 3, name: 'Erkundet',   color: '#4aff7a' },
    { id: 4, name: 'Nebel',      color: '#aaaaaa' },
  ],
  measureValue: 1,
  measureUnit: 'km',
  pinSize: 'M',
  rulerColor: '#ffe066',
  rulerOpacity: 1,
  rulerWidth: 2,
};

// ── Grid SVG Overlay ──────────────────────────────────────────────────────────

interface GridOverlayProps {
  settings: GridSettings;
  imgW: number;
  imgH: number;
  cells: Map<string, number>;
  gridMode: boolean;
  sessionId: string;
  mapId: string;
  database: DatabaseLike;
  onCellsChange: (cells: Map<string, number>) => void;
  onCellContextMenu: (cellKey: string, screenX: number, screenY: number) => void;
}

function hexPoints(cx: number, cy: number, r: number, flat: boolean): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + (flat ? 0 : Math.PI / 6);
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  }).join(' ');
}

export function GridOverlaySvg({
  settings, imgW, imgH, cells, gridMode,
  sessionId, mapId, database, onCellsChange, onCellContextMenu,
}: GridOverlayProps) {
  const { cellSize, type, lineColor, lineOpacity, lineWidth, lineDash, visible, cellStates } = settings;
  const isPainting = useRef(false);
  const lastPaintKey = useRef<string | null>(null);

  const strokeDash = lineDash === 'dashed'
    ? `${cellSize * 0.3},${cellSize * 0.15}`
    : lineDash === 'dotted' ? `2,${cellSize * 0.2}` : undefined;

  function cellKeyFor(x: number, y: number): string {
    return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
  }

  function clientToSvg(svgEl: SVGSVGElement, clientX: number, clientY: number) {
    const pt = svgEl.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    return pt.matrixTransform(svgEl.getScreenCTM()!.inverse());
  }

  function paintCell(svgEl: SVGSVGElement, clientX: number, clientY: number, stateOverride?: number) {
    const { x, y } = clientToSvg(svgEl, clientX, clientY);
    const key = cellKeyFor(x, y);
    if (key === lastPaintKey.current) return;
    lastPaintKey.current = key;
    const current = cells.get(key) ?? 0;
    const next = stateOverride !== undefined ? stateOverride : (current === 0 ? 1 : 0);
    void setCellState(database, sessionId, mapId, key, next).then(() => {
      const m = new Map(cells);
      if (next === 0) m.delete(key); else m.set(key, next);
      onCellsChange(m);
    });
  }

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!gridMode || e.button !== 0) return;
    e.stopPropagation();
    isPainting.current = true;
    lastPaintKey.current = null;
    paintCell(e.currentTarget, e.clientX, e.clientY);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!gridMode || !isPainting.current) return;
    e.stopPropagation();
    paintCell(e.currentTarget, e.clientX, e.clientY, 1);
  }

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    if (e.button === 0) { isPainting.current = false; lastPaintKey.current = null; }
  }

  function handleContextMenu(e: React.MouseEvent<SVGSVGElement>) {
    if (!gridMode) return;
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = clientToSvg(e.currentTarget, e.clientX, e.clientY);
    onCellContextMenu(cellKeyFor(x, y), e.clientX, e.clientY);
  }

  if (!visible && cells.size === 0) return null;

  const lines: React.ReactNode[] = [];
  if (visible && type === 'square') {
    for (let x = 0; x <= imgW; x += cellSize) lines.push(<line key={`v${x}`} x1={x} y1={0} x2={x} y2={imgH} />);
    for (let y = 0; y <= imgH; y += cellSize) lines.push(<line key={`h${y}`} x1={0} y1={y} x2={imgW} y2={y} />);
  }

  const hexPolys: React.ReactNode[] = [];
  if (visible && (type === 'hex-flat' || type === 'hex-pointy')) {
    const flat = type === 'hex-flat';
    const r = cellSize / 2;
    const cols = Math.ceil(imgW / (cellSize * 0.75)) + 2;
    const rows = Math.ceil(imgH / (cellSize * 0.866)) + 2;
    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const cx = flat ? col * cellSize * 0.75 : col * cellSize + (row % 2) * cellSize * 0.5;
        const cy = flat ? row * cellSize * 0.866 + (col % 2) * cellSize * 0.433 : row * cellSize * 0.866;
        hexPolys.push(<polygon key={`h${col}:${row}`} points={hexPoints(cx, cy, r, flat)} />);
      }
    }
  }

  const activeCellRects: React.ReactNode[] = [];
  cells.forEach((stateId, key) => {
    const st = cellStates.find((s) => s.id === stateId);
    if (!st) return;
    const [col, row] = key.split(':').map(Number);
    activeCellRects.push(
      <rect key={key}
        x={col * cellSize + 1} y={row * cellSize + 1}
        width={cellSize - 2} height={cellSize - 2}
        fill={`${st.color}33`} stroke={st.color} strokeWidth={2}
        style={{ filter: `drop-shadow(0 0 5px ${st.color})` }}
      />,
    );
  });

  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible', cursor: gridMode ? 'cell' : 'default' }}
      width={imgW} height={imgH}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
    >
      <g stroke={lineColor} strokeOpacity={lineOpacity} strokeWidth={lineWidth} fill="none" strokeDasharray={strokeDash}>
        {lines}
        {hexPolys}
      </g>
      {activeCellRects}
    </svg>
  );
}

// ── Grid Controls Panel ───────────────────────────────────────────────────────

interface GridControlsProps {
  settings: GridSettings;
  onChange: (s: GridSettings) => void;
  activeCellCount: number;
  sessionId: string;
  mapId: string;
  database: DatabaseLike;
  onClear: () => void;
}

const PRESETS = [
  { color: '#000000' }, { color: '#ffffff' }, { color: '#ff8800' }, { color: '#44aaff' },
];

export function GridControlsPanel({ settings, onChange, activeCellCount, onClear }: GridControlsProps) {
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 80, left: 120 });
  const btnRef = useRef<HTMLButtonElement>(null);

  function toggleOpen() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPanelPos({ top: r.top, left: r.right + 8 });
    }
    setOpen((v) => !v);
  }

  function set<K extends keyof GridSettings>(key: K, val: GridSettings[K]) {
    onChange({ ...settings, [key]: val });
  }

  return (
    <div className="grid-controls-wrap">
      <button ref={btnRef} className={`map-tool-btn${open ? ' active' : ''}`} onClick={toggleOpen} title="Grid Controls">⊞</button>

      {open && (
        <div className="grid-controls-panel" style={{ position: 'fixed', top: panelPos.top, left: panelPos.left }}>
          <div className="grid-controls-panel__header">
            <span>Grid Controls</span>
            <button onClick={() => setOpen(false)}>✕</button>
          </div>

          <div className="grid-controls-panel__row">
            <div className="grid-controls-panel__col">
              <label>Color</label>
              <div className="grid-controls-panel__colors">
                {PRESETS.map((p) => (
                  <button key={p.color} className={`grid-color-swatch${settings.lineColor === p.color ? ' active' : ''}`}
                    style={{ background: p.color, border: p.color === '#ffffff' ? '1px solid #666' : 'none' }}
                    onClick={() => set('lineColor', p.color)} />
                ))}
                <input type="color" value={settings.lineColor} onChange={(e) => set('lineColor', e.target.value)} className="grid-color-picker" />
              </div>
            </div>
            <div className="grid-controls-panel__col">
              <label>Opacity</label>
              <input type="range" min={0} max={1} step={0.05} value={settings.lineOpacity}
                onChange={(e) => set('lineOpacity', Number(e.target.value))} />
            </div>
          </div>

          <div className="grid-controls-panel__row">
            <div className="grid-controls-panel__col">
              <label>Grid Size</label>
              <div className="grid-controls-panel__number-input">
                <input type="number" min={10} max={200} value={settings.cellSize}
                  onChange={(e) => set('cellSize', Number(e.target.value))} />
                <span>px</span>
              </div>
            </div>
            <div className="grid-controls-panel__col">
              <label>Line Width</label>
              <div className="grid-controls-panel__number-input">
                <input type="number" min={0.5} max={5} step={0.5} value={settings.lineWidth}
                  onChange={(e) => set('lineWidth', Number(e.target.value))} />
                <span>px</span>
              </div>
            </div>
            <div className="grid-controls-panel__col">
              <label>Snapping</label>
              <button className={`grid-toggle${settings.snapping ? ' active' : ''}`}
                onClick={() => set('snapping', !settings.snapping)}>
                {settings.snapping ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="grid-controls-panel__row">
            <div className="grid-controls-panel__col">
              <label>Grid Type</label>
              <div className="grid-type-btns">
                {(['square', 'hex-pointy', 'hex-flat'] as const).map((t) => (
                  <button key={t} className={`grid-type-btn${settings.type === t ? ' active' : ''}`}
                    onClick={() => set('type', t)} title={t}>
                    {t === 'square' ? '⬜' : t === 'hex-pointy' ? '⬡' : '⬢'}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid-controls-panel__col">
              <label>Line Type</label>
              <div className="grid-type-btns">
                {(['solid', 'dashed', 'dotted'] as const).map((d) => (
                  <button key={d} className={`grid-type-btn${settings.lineDash === d ? ' active' : ''}`}
                    onClick={() => set('lineDash', d)}>
                    {d === 'solid' ? '—' : d === 'dashed' ? '- -' : '···'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-controls-panel__row">
            <div className="grid-controls-panel__col">
              <label>Visible</label>
              <button className={`grid-toggle${settings.visible ? ' active' : ''}`}
                onClick={() => set('visible', !settings.visible)}>
                {settings.visible ? 'Sichtbar' : 'Versteckt'}
              </button>
            </div>
            <div className="grid-controls-panel__col">
              <label>Pin-Größe</label>
              <div className="grid-type-btns">
                {(['S', 'M', 'L'] as const).map((sz) => (
                  <button key={sz} className={`grid-type-btn${settings.pinSize === sz ? ' active' : ''}`}
                    onClick={() => set('pinSize', sz)}>{sz}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid-controls-panel__section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Zell-Zustände</span>
            <button className="grid-state-add-btn" onClick={() => {
              const maxId = settings.cellStates.reduce((m, s) => Math.max(m, s.id), 0);
              set('cellStates', [...settings.cellStates, { id: maxId + 1, name: 'Neu', color: '#aaaaaa' }]);
            }}>+ Neu</button>
          </div>
          {settings.cellStates.map((st, i) => (
            <div key={st.id} className="grid-controls-panel__row grid-controls-panel__state-row">
              <input type="color" value={st.color}
                onChange={(e) => {
                  const next = settings.cellStates.map((s, j) => j === i ? { ...s, color: e.target.value } : s);
                  set('cellStates', next);
                }} className="grid-color-picker" />
              <input className="grid-state-name" value={st.name}
                onChange={(e) => {
                  const next = settings.cellStates.map((s, j) => j === i ? { ...s, name: e.target.value } : s);
                  set('cellStates', next);
                }} />
              <button className="grid-state-del-btn" title="Löschen"
                onClick={() => set('cellStates', settings.cellStates.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}

          <div className="grid-controls-panel__section-title">Maßstab (1 Kästchen =)</div>
          <div className="grid-controls-panel__row" style={{ padding: '4px 12px 8px' }}>
            <div className="grid-controls-panel__number-input" style={{ flex: 1 }}>
              <input type="number" min={0.001} step={0.1} value={settings.measureValue}
                onChange={(e) => set('measureValue', Number(e.target.value))}
                style={{ width: 64 }} />
            </div>
            <input className="grid-state-name" value={settings.measureUnit}
              onChange={(e) => set('measureUnit', e.target.value)}
              placeholder="km / m / miles"
              style={{ flex: 1, marginLeft: 6 }} />
          </div>

          <div className="grid-controls-panel__section-title">Lineal</div>
          <div className="grid-controls-panel__row" style={{ padding: '4px 12px 8px', gap: 8 }}>
            <div className="grid-controls-panel__col">
              <label>Farbe</label>
              <input type="color" value={settings.rulerColor} onChange={(e) => set('rulerColor', e.target.value)} className="grid-color-picker" />
            </div>
            <div className="grid-controls-panel__col">
              <label>Opacity</label>
              <input type="range" min={0} max={1} step={0.05} value={settings.rulerOpacity}
                onChange={(e) => set('rulerOpacity', Number(e.target.value))} style={{ width: 70 }} />
            </div>
            <div className="grid-controls-panel__col">
              <label>Dicke</label>
              <div className="grid-controls-panel__number-input">
                <input type="number" min={1} max={10} step={0.5} value={settings.rulerWidth}
                  onChange={(e) => set('rulerWidth', Number(e.target.value))} />
                <span>px</span>
              </div>
            </div>
          </div>

          <div className="grid-controls-panel__footer">
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{activeCellCount} Zellen markiert</span>
            <button className="btn" style={{ fontSize: '0.75rem', color: 'var(--color-status-failure)' }} onClick={onClear}>
              Alle leeren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Hook for cell state management ───────────────────────────────────────────

export function useGridCells(database: DatabaseLike, sessionId: string, mapId: string) {
  const [cells, setCells] = useState<Map<string, number>>(new Map());

  const load = useCallback(() => {
    getActivatedCells(database, sessionId, mapId)
      .then((rows) => setCells(new Map(rows.map((r) => [r.cell_key, r.state]))))
      .catch(console.error);
  }, [database, sessionId, mapId]);

  return { cells, setCells, load };
}

// ── Cell Context Menu (rendered outside transform) ────────────────────────────

interface CellContextMenuProps {
  x: number;
  y: number;
  cellKey: string;
  cellStates: CellState[];
  onPick: (key: string, stateId: number) => void;
  onClose: () => void;
}

export function CellContextMenu({ x, y, cellKey, cellStates, onPick, onClose }: CellContextMenuProps) {
  return (
    <div
      className="map-context-menu"
      style={{ position: 'fixed', left: x, top: y, zIndex: 2000 }}
      onMouseLeave={onClose}
    >
      <div className="map-context-menu__title">Zell-Zustand</div>
      <button className="map-context-menu__item map-context-menu__item--off" onClick={() => onPick(cellKey, 0)}>
        <span className="map-context-menu__dot" style={{ background: 'transparent', border: '1px solid #666' }} />
        Leer
      </button>
      {cellStates.map((st) => (
        <button key={st.id} className="map-context-menu__item" onClick={() => onPick(cellKey, st.id)}>
          <span className="map-context-menu__dot" style={{ background: st.color, boxShadow: `0 0 4px ${st.color}` }} />
          {st.name}
        </button>
      ))}
    </div>
  );
}
