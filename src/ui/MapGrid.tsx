import { useState, useCallback, useRef, useTransition, useEffect, memo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getActivatedCells, setCellState, clearAllCells } from '../services/session-grid-service';

export interface CellState {
  id: number;
  name: string;
  color: string;
}

export interface GridSettings {
  visible: boolean;
  type: 'square' | 'hex-flat';
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
  scale: number;
  cells: Map<string, number>;
  gridMode: boolean;
  activeCellStateId: number;
  sessionId: string;
  mapId: string;
  database: DatabaseLike;
  onCellsChange: (cells: Map<string, number>) => void;
  onCellContextMenu: (cellKey: string, screenX: number, screenY: number) => void;
}

// Static grid canvas — one bitmap for all grid types.
// Drawn at viewport resolution (imgW*scale × imgH*scale), CSS-scaled back to imgW×imgH.
// stroke() workload is proportional to screen pixels, not the source image megapixels.
// Redraws only when settings or scale change; ruler/paint re-renders never touch it.
const GridCanvas = memo(function GridCanvas({ imgW, imgH, scale, cellSize, type, lineColor, lineOpacity, lineWidth, lineDash }: {
  imgW: number; imgH: number; scale: number; cellSize: number; type: 'square' | 'hex-flat';
  lineColor: string; lineOpacity: number; lineWidth: number; lineDash: 'solid' | 'dashed' | 'dotted';
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Round scale to 2dp so minor zoom deltas don't trigger redraws on every scroll event
  const snapScale = Math.round(scale * 100) / 100;
  const drawW = Math.max(1, Math.ceil(imgW * snapScale));
  const drawH = Math.max(1, Math.ceil(imgH * snapScale));
  const s = cellSize * snapScale; // cell size in canvas pixels

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, drawW, drawH);
    ctx.strokeStyle = lineColor;
    ctx.globalAlpha = lineOpacity;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(
      lineDash === 'dashed' ? [s * 0.3, s * 0.15]
      : lineDash === 'dotted' ? [2, s * 0.2]
      : [],
    );

    // Build the entire path as an SVG path string, then hand it to Path2D.
    // Path2D parses the string natively (C++), replacing thousands of individual
    // JS→native bridge calls (moveTo/lineTo/closePath) with a single dispatch.
    let d = '';
    if (type === 'square') {
      for (let x = 0; x <= drawW; x += s) d += `M${x},0L${x},${drawH}`;
      for (let y = 0; y <= drawH; y += s) d += `M0,${y}L${drawW},${y}`;
    } else {
      const r = s / 2;
      const cols = Math.ceil(drawW / (s * 0.75)) + 2;
      const rows = Math.ceil(drawH / (s * 0.866)) + 2;
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const cx = col * s * 0.75;
          const cy = row * s * 0.866 + (col % 2) * s * 0.433;
          for (let i = 0; i < 6; i++) {
            const a = (Math.PI / 3) * i;
            const px = cx + r * Math.cos(a);
            const py = cy + r * Math.sin(a);
            d += i === 0 ? `M${px},${py}` : `L${px},${py}`;
          }
          d += 'Z';
        }
      }
    }
    ctx.stroke(new Path2D(d));
  }, [drawW, drawH, s, type, lineColor, lineOpacity, lineWidth, lineDash]);

  return (
    <canvas ref={canvasRef} width={drawW} height={drawH}
      style={{ position: 'absolute', top: 0, left: 0, width: imgW, height: imgH, pointerEvents: 'none' }} />
  );
});

export function GridOverlaySvg({
  settings, imgW, imgH, scale, cells, gridMode, activeCellStateId,
  sessionId, mapId, database, onCellsChange, onCellContextMenu,
}: GridOverlayProps) {
  const { cellSize, type, lineColor, lineOpacity, lineWidth, lineDash, visible, cellStates } = settings;
  const isPainting = useRef(false);
  const lastPaintKey = useRef<string | null>(null);

  function cellKeyFor(x: number, y: number): string {
    if (type === 'square') {
      return `${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}`;
    }
    // hex-flat: nearest center via 3×3 candidate search
    const approxCol = Math.round(x / (cellSize * 0.75));
    const approxRow = Math.round((y - (approxCol % 2) * cellSize * 0.433) / (cellSize * 0.866));
    let bestKey = `${approxCol}:${approxRow}`;
    let bestDist = Infinity;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = approxCol + dc, r = approxRow + dr;
        const cx = c * cellSize * 0.75;
        const cy = r * cellSize * 0.866 + (c % 2) * cellSize * 0.433;
        const dist = (x - cx) ** 2 + (y - cy) ** 2;
        if (dist < bestDist) { bestDist = dist; bestKey = `${c}:${r}`; }
      }
    }
    return bestKey;
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
    const next = stateOverride !== undefined ? stateOverride : (current === activeCellStateId ? 0 : activeCellStateId);
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
    paintCell(e.currentTarget, e.clientX, e.clientY, activeCellStateId);
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

  const activeCellShapes: React.ReactNode[] = [];
  cells.forEach((stateId, key) => {
    const st = cellStates.find((s) => s.id === stateId);
    if (!st) return;
    const [col, row] = key.split(':').map(Number);
    if (type === 'square') {
      activeCellShapes.push(
        <rect key={key}
          x={col * cellSize + 1} y={row * cellSize + 1}
          width={cellSize - 2} height={cellSize - 2}
          fill={`${st.color}33`} stroke={st.color} strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 5px ${st.color})` }}
        />,
      );
    } else {
      // hex-flat active cell overlay
      const cx = col * cellSize * 0.75;
      const cy = row * cellSize * 0.866 + (col % 2) * cellSize * 0.433;
      const r = cellSize / 2 - 1;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (Math.PI / 3) * i;
        return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
      }).join(' ');
      activeCellShapes.push(
        <polygon key={key} points={pts}
          fill={`${st.color}33`} stroke={st.color} strokeWidth={2}
          style={{ filter: `drop-shadow(0 0 5px ${st.color})` }}
        />,
      );
    }
  });

  const svgStyle: React.CSSProperties = {
    position: 'absolute', top: 0, left: 0, overflow: 'visible',
    cursor: gridMode ? 'cell' : 'default',
  };

  return (
    <>
      {visible && (
        <GridCanvas imgW={imgW} imgH={imgH} scale={scale} cellSize={cellSize} type={type}
          lineColor={lineColor} lineOpacity={lineOpacity} lineWidth={lineWidth} lineDash={lineDash} />
      )}
      <svg style={svgStyle} width={imgW} height={imgH}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onContextMenu={handleContextMenu}
      >
        {activeCellShapes}
      </svg>
    </>
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
  const { t } = useTranslation('map');
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState({ top: 80, left: 120 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [isGridChanging, startGridTransition] = useTransition();

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

  function setGridType(gridType: GridSettings['type']) {
    startGridTransition(() => {
      onChange({ ...settings, type: gridType });
    });
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
              <label>Grid Type{isGridChanging && ' …'}</label>
              <div className="grid-type-btns">
                {(['square', 'hex-flat'] as const).map((gt) => (
                  <button key={gt}
                    className={`grid-type-btn${settings.type === gt ? ' active' : ''}${isGridChanging ? ' pending' : ''}`}
                    onClick={() => setGridType(gt)} title={gt} disabled={isGridChanging}>
                    {gt === 'square' ? '⬜' : '⬢'}
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
              {t('all')}
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
