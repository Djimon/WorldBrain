import { useRef, useEffect } from 'react';

interface GridOverlayProps {
  gridType: 'square' | 'hex';
  cellSize: number;
  visible: boolean;
  pixelsPerWorldUnit?: number;
  opacity?: number;
  width?: number;
  height?: number;
}

export function GridOverlay({ gridType, cellSize, visible, pixelsPerWorldUnit, opacity = 0.5, width = 1000, height = 1000 }: GridOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!visible || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const effectiveCellSize = pixelsPerWorldUnit ? cellSize * pixelsPerWorldUnit : cellSize;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (gridType === 'square') {
      for (let x = 0; x <= width; x += effectiveCellSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += effectiveCellSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
    } else {
      const r = effectiveCellSize;
      for (let col = 0; col * r * 1.5 <= width; col++) {
        for (let row = 0; row * r * Math.sqrt(3) <= height; row++) {
          const cx = col * r * 1.5;
          const cy = row * r * Math.sqrt(3) + (col % 2 === 1 ? (r * Math.sqrt(3)) / 2 : 0);
          ctx.moveTo(cx + r, cy);
          for (let i = 1; i < 6; i++) {
            const a = (Math.PI / 180) * (60 * i - 30);
            ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
          }
          ctx.closePath();
        }
      }
    }
    ctx.stroke();
  }, [gridType, cellSize, visible, pixelsPerWorldUnit, opacity, width, height]);

  if (!visible) return null;

  return (
    <canvas
      ref={canvasRef}
      data-grid-type={gridType}
      aria-label={`${gridType} grid`}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    />
  );
}

interface GridToggleProps {
  onToggle: (visible: boolean) => void;
  visible: boolean;
}

export function GridToggle({ onToggle, visible }: GridToggleProps) {
  return (
    <button
      aria-pressed={visible}
      onClick={() => onToggle(!visible)}
    >
      Toggle Grid
    </button>
  );
}

interface GridSettingsProps {
  cellSize: number;
  onCellSizeChange: (size: number) => void;
  gridType: 'square' | 'hex';
  onGridTypeChange: (type: 'square' | 'hex') => void;
}

export function GridSettings({ cellSize, onCellSizeChange, gridType, onGridTypeChange }: GridSettingsProps) {
  return (
    <div>
      <label htmlFor="cell-size">Cell Size</label>
      <input
        id="cell-size"
        type="number"
        value={cellSize}
        onChange={e => onCellSizeChange(Number(e.target.value))}
      />
      <label htmlFor="grid-type">Grid Type</label>
      <select
        id="grid-type"
        value={gridType}
        onChange={e => onGridTypeChange(e.target.value as 'square' | 'hex')}
      >
        <option value="square">Square</option>
        <option value="hex">Hex</option>
      </select>
    </div>
  );
}
