import { SVGOverlay, useMap } from 'react-leaflet';

interface GridOverlayProps {
  gridType: 'square' | 'hex';
  cellSize: number;
  visible: boolean;
  pixelsPerWorldUnit?: number;
  opacity?: number;
}

export function GridOverlay({ gridType, cellSize, visible, pixelsPerWorldUnit, opacity = 0.5 }: GridOverlayProps) {
  const map = useMap();
  if (!visible) return null;

  const bounds = map.getBounds();
  const north = bounds.getNorth();
  const south = bounds.getSouth();
  const east = bounds.getEast();
  const west = bounds.getWest();
  const width = east - west;
  const height = north - south;

  const effectiveCellSize = pixelsPerWorldUnit ? cellSize * pixelsPerWorldUnit : cellSize;

  const svgBounds: [[number, number], [number, number]] = [[south, west], [north, east]];

  let paths: string;
  if (gridType === 'square') {
    const lines: string[] = [];
    for (let x = 0; x <= width; x += effectiveCellSize) {
      lines.push(`M ${x} 0 L ${x} ${height}`);
    }
    for (let y = 0; y <= height; y += effectiveCellSize) {
      lines.push(`M 0 ${y} L ${width} ${y}`);
    }
    paths = lines.join(' ');
  } else {
    // hex grid approximation
    const r = effectiveCellSize;
    const lines: string[] = [];
    for (let col = 0; col * r * 1.5 <= width; col++) {
      for (let row = 0; row * r * Math.sqrt(3) <= height; row++) {
        const cx = col * r * 1.5;
        const cy = row * r * Math.sqrt(3) + (col % 2 === 1 ? r * Math.sqrt(3) / 2 : 0);
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 180) * (60 * i - 30);
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(' ');
        lines.push(`M ${pts} Z`);
      }
    }
    paths = lines.join(' ');
  }

  return (
    <SVGOverlay bounds={svgBounds}>
      <path d={paths} stroke="rgba(0,0,0,0.5)" strokeWidth="1" fill="none" opacity={opacity} />
    </SVGOverlay>
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
