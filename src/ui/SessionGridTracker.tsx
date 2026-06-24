import { useState } from 'react';
import { SVGOverlay } from 'react-leaflet';
import { getActivatedCells, activateCell, deactivateCell, clearAllCells } from '../services/session-grid-service';
import type { DatabaseLike } from '../services/entity-service';

interface ActivatedCell {
  cell_key: string;
  session_id: string;
  activated_at: number;
}

interface Props {
  sessionId: string;
  mapId: string;
  database: DatabaseLike;
  cellSize: number;
}

export function SessionGridTracker({ sessionId, mapId, database, cellSize }: Props) {
  const [paintMode, setPaintMode] = useState(false);
  const [cells, setCells] = useState<ActivatedCell[]>(() =>
    getActivatedCells(database, sessionId, mapId)
  );

  function refresh() {
    setCells(getActivatedCells(database, sessionId, mapId));
  }

  function handleClearAll() {
    clearAllCells(database, sessionId, mapId);
    setCells([]);
  }

  function handleMapClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!paintMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    const key = `${col}:${row}`;
    if (cells.some(c => c.cell_key === key)) {
      deactivateCell(database, sessionId, mapId, key);
    } else {
      activateCell(database, sessionId, mapId, key);
    }
    refresh();
  }

  const svgBounds: [[number, number], [number, number]] = [[0, 0], [1000, 1000]];

  return (
    <div>
      <div>
        <button
          aria-pressed={paintMode}
          onClick={() => setPaintMode(p => !p)}
        >
          {paintMode ? 'Tracking Mode: ON' : 'Paint Mode'}
        </button>
        <span>{cells.length} cell{cells.length !== 1 ? 's' : ''} activated</span>
        <button onClick={handleClearAll}>Clear All</button>
      </div>
      <canvas
        data-testid="map-canvas"
        width={1000}
        height={1000}
        onClick={handleMapClick}
        style={{ cursor: paintMode ? 'crosshair' : 'default' }}
      />
      <SVGOverlay bounds={svgBounds}>
        <g>
          {cells.map(cell => {
            const [col, row] = cell.cell_key.split(':').map(Number);
            return (
              <rect
                key={cell.cell_key}
                x={col * cellSize}
                y={row * cellSize}
                width={cellSize}
                height={cellSize}
                fill="rgba(255,100,0,0.3)"
              />
            );
          })}
        </g>
      </SVGOverlay>
    </div>
  );
}
