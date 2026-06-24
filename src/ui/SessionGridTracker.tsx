import { useState } from 'react';
import { SVGOverlay } from 'react-leaflet';
import { getActivatedCells, activateCell, deactivateCell, clearAllCells } from '../services/session-grid-service';

interface ActivatedCell {
  cell_key: string;
  session_id: string;
  activated_at: number;
}

interface Props {
  sessionId: string;
  mapId: string;
  database: unknown;
  cellSize: number;
}

export function SessionGridTracker({ sessionId, mapId, database, cellSize }: Props) {
  const [paintMode, setPaintMode] = useState(false);
  const [cells, setCells] = useState<ActivatedCell[]>(() =>
    getActivatedCells(database as never, sessionId, mapId)
  );

  function refresh() {
    setCells(getActivatedCells(database as never, sessionId, mapId));
  }

  function handleClearAll() {
    clearAllCells(database as never, sessionId, mapId);
    setCells([]);
  }

  function handleMapClick(e: unknown) {
    if (!paintMode) return;
    const ev = e as { latlng: { lat: number; lng: number } };
    const col = Math.floor(ev.latlng.lng / cellSize);
    const row = Math.floor(ev.latlng.lat / cellSize);
    const key = `${col}:${row}`;
    if (cells.some(c => c.cell_key === key)) {
      deactivateCell(database as never, sessionId, mapId, key);
    } else {
      activateCell(database as never, sessionId, mapId, key);
    }
    refresh();
  }
  void handleMapClick;

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
