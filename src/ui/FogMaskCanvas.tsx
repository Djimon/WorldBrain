// M15-S04: Fog-Layer & Paint-Tools — Paint-Oberfläche (#276)
// Renders the fog mask as a <canvas> overlay in the map's CSS-transform
// container, above image layers. Paints via pointer down/move/up in map
// coordinates (PaintInteractionLayer's existing pattern), NOT Leaflet.
// On stroke end, calls onStrokeEnd with the updated mask dataURL — the
// caller (MapViewer) persists it via updateLayer (debounce acceptable).
import { useEffect, useRef, useState } from 'react';
import type { FogToolMode, FogToolShape } from './FogTools';
import { stampCells } from './fogStampGeometry';
import type { CellCoord, FogStampGridType, FogStampLevel } from './fogStampGeometry';

export interface FogMaskCanvasProps {
  layerId: string;
  maskData: string | null;
  imgW: number;
  imgH: number;
  mode: FogToolMode;
  shape: FogToolShape;
  brushSize: number;
  feather: number;
  active: boolean;
  onStrokeEnd: (maskDataUrl: string) => void;
  // #295: grid-aware fog stamp geometry (only relevant when shape ===
  // 'grid-stamp'). Not yet implemented (RED phase, TDD).
  gridType?: FogStampGridType;
  gridCellSize?: number;
  stampLevel?: FogStampLevel;
}

export function FogMaskCanvas({
  layerId, maskData, imgW, imgH, mode, shape, brushSize, feather, active, onStrokeEnd,
  gridType, gridCellSize, stampLevel,
}: FogMaskCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);

  // (Re)load the stored mask onto the canvas whenever it changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!maskData) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    img.src = maskData;
  }, [maskData, imgW, imgH]);

  function toCanvasCoords(clientX: number, clientY: number): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width ? canvas.width / rect.width : 1;
    const sy = rect.height ? canvas.height / rect.height : 1;
    return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy };
  }

  function paintOp(ctx: CanvasRenderingContext2D) {
    // reveal = cut alpha (map shows through); cover = add opaque coverage.
    ctx.globalCompositeOperation = mode === 'reveal' ? 'destination-out' : 'source-over';
    ctx.fillStyle = '#000';
  }

  function stampBrush(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    paintOp(ctx);
    if (feather > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = feather; }
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, brushSize / 2), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Square dab (rectangular brush) — edge = brushSize, centered on the cursor.
  function stampSquare(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.save();
    paintOp(ctx);
    if (feather > 0) { ctx.shadowColor = '#000'; ctx.shadowBlur = feather; }
    ctx.fillRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
    ctx.restore();
  }

  // Region fill — drag corner to corner.
  function stampRect(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
    ctx.save();
    paintOp(ctx);
    ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.restore();
  }

  // #295: maps a canvas pixel to its grid cell — same geometry as
  // MapGrid.tsx's cellKeyFor/GridLayer (reused, not reinvented).
  function cellUnderPoint(x: number, y: number, cellSize: number): CellCoord {
    if (gridType === 'square') return { col: Math.floor(x / cellSize), row: Math.floor(y / cellSize) };
    const approxCol = Math.round(x / (cellSize * 0.75));
    const approxRow = Math.round((y - (approxCol % 2) * cellSize * 0.433) / (cellSize * 0.866));
    let best: CellCoord = { col: approxCol, row: approxRow };
    let bestDist = Infinity;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        const c = approxCol + dc, r = approxRow + dr;
        const cx = c * cellSize * 0.75;
        const cy = r * cellSize * 0.866 + (c % 2) * cellSize * 0.433;
        const dist = (x - cx) ** 2 + (y - cy) ** 2;
        if (dist < bestDist) { bestDist = dist; best = { col: c, row: r }; }
      }
    }
    return best;
  }

  // #295: fills one grid cell's exact footprint — same square-rect / hex-polygon
  // geometry as MapGrid.tsx's CellStateLayer (reused, not reinvented).
  function fillCell(ctx: CanvasRenderingContext2D, cell: CellCoord, cellSize: number) {
    if (gridType === 'square') {
      ctx.fillRect(cell.col * cellSize, cell.row * cellSize, cellSize, cellSize);
      return;
    }
    const cx = cell.col * cellSize * 0.75;
    const cy = cell.row * cellSize * 0.866 + (cell.col % 2) * cellSize * 0.433;
    const r = cellSize / 2;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const px = cx + r * Math.cos(a), py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  // #295 preview: same hex-vertex geometry as fillCell, but as an SVG points
  // string (for the grid-stamp outline preview below) instead of a canvas path.
  function hexPoints(cell: CellCoord, cellSize: number): string {
    const cx = cell.col * cellSize * 0.75;
    const cy = cell.row * cellSize * 0.866 + (cell.col % 2) * cellSize * 0.433;
    const r = cellSize / 2;
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
  }

  // Grid-aware stamp (#295) — covers every cell stampCells() returns for the
  // active level/grid type, centered on the cell under the cursor.
  function stampGrid(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (!gridType || !gridCellSize) return;
    const center = cellUnderPoint(x, y, gridCellSize);
    ctx.save();
    paintOp(ctx);
    for (const cell of stampCells(center, stampLevel ?? 0, gridType)) fillCell(ctx, cell, gridCellSize);
    ctx.restore();
  }

  function dab(ctx: CanvasRenderingContext2D, x: number, y: number) {
    if (shape === 'brush') stampBrush(ctx, x, y);
    else if (shape === 'square') stampSquare(ctx, x, y);
    else if (shape === 'grid-stamp') stampGrid(ctx, x, y);
  }

  function emit() {
    const canvas = canvasRef.current;
    let out = maskData ?? '';
    // AP-006 exception: mask encode may be unavailable (no canvas backend in
    // headless test env) — fall back to the prior mask string.
    try {
      const d = canvas?.toDataURL('image/png');
      if (d) out = d;
    } catch { /* no-op */ }
    onStrokeEnd(out);
  }

  function handleDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const p = toCanvasCoords(e.clientX, e.clientY);
    start.current = p;
    const ctx = canvas.getContext('2d');
    if (ctx) dab(ctx, p.x, p.y); // brush/square paint immediately; region waits for up
    try { canvas.setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  }

  function handleMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active) return;
    const p = toCanvasCoords(e.clientX, e.clientY);
    setHover(p); // preview follows the cursor (also drives the region rubber-band)
    if (!drawing.current || shape === 'region') return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    dab(ctx, p.x, p.y);
  }

  function handleUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!active || !drawing.current) return;
    drawing.current = false;
    const ctx = canvasRef.current?.getContext('2d') ?? null;
    if (ctx && shape === 'region' && start.current) {
      const p = toCanvasCoords(e.clientX, e.clientY);
      stampRect(ctx, start.current.x, start.current.y, p.x, p.y);
    }
    start.current = null;
    emit();
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        data-fog-layer-id={layerId}
        width={imgW}
        height={imgH}
        className="fog-mask-canvas"
        style={{ position: 'absolute', top: 0, left: 0, pointerEvents: active ? 'auto' : 'none', cursor: active ? (shape === 'region' ? 'crosshair' : 'none') : undefined }}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerLeave={() => setHover(null)}
      />
      {/* Dab preview for brush (circle) and square (rectangle) — circle diameter
          and square edge are both brushSize (= 2 x radius), so switching keeps the
          same visual size. */}
      {active && hover && shape !== 'region' && shape !== 'grid-stamp' && (
        <div
          className="fog-brush-preview"
          style={{
            position: 'absolute',
            left: hover.x - brushSize / 2,
            top: hover.y - brushSize / 2,
            width: brushSize,
            height: brushSize,
            borderRadius: shape === 'brush' ? '50%' : 0,
            pointerEvents: 'none',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
            filter: feather > 0 ? `blur(${feather / 4}px)` : undefined,
          }}
        />
      )}
      {/* #295: grid-stamp preview — outlines the actual cells the stamp would
          cover, snapped to the grid under the cursor, so the user sees what
          gets revealed/covered before committing. */}
      {active && hover && shape === 'grid-stamp' && gridType && gridCellSize && (
        <svg
          className="fog-grid-stamp-preview"
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={imgW}
          height={imgH}
        >
          {stampCells(cellUnderPoint(hover.x, hover.y, gridCellSize), stampLevel ?? 0, gridType).map((cell) => (
            gridType === 'square' ? (
              <rect
                key={`${cell.col}:${cell.row}`}
                x={cell.col * gridCellSize} y={cell.row * gridCellSize}
                width={gridCellSize} height={gridCellSize}
                fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.9)" strokeWidth={2}
              />
            ) : (
              <polygon
                key={`${cell.col}:${cell.row}`}
                points={hexPoints(cell, gridCellSize)}
                fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.9)" strokeWidth={2}
              />
            )
          ))}
        </svg>
      )}
      {/* Region rubber-band while dragging corner to corner. */}
      {active && hover && shape === 'region' && drawing.current && start.current && (
        <div
          className="fog-region-preview"
          style={{
            position: 'absolute',
            left: Math.min(start.current.x, hover.x),
            top: Math.min(start.current.y, hover.y),
            width: Math.abs(hover.x - start.current.x),
            height: Math.abs(hover.y - start.current.y),
            pointerEvents: 'none',
            border: '1px dashed rgba(255,255,255,0.9)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.6)',
            background: 'rgba(255,255,255,0.08)',
          }}
        />
      )}
    </>
  );
}

export default FogMaskCanvas;
