import { useRef, useEffect, useState } from 'react';
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 1000, 1000);
    ctx.fillStyle = 'rgba(255,100,0,0.3)';
    cells.forEach(cell => {
      const [col, row] = cell.cell_key.split(':').map(Number);
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
    });
  }, [cells, cellSize]);

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
    const col = Math.floor((e.clientX - rect.left) / cellSize);
    const row = Math.floor((e.clientY - rect.top) / cellSize);
    const key = `${col}:${row}`;
    if (cells.some(c => c.cell_key === key)) {
      deactivateCell(database, sessionId, mapId, key);
    } else {
      activateCell(database, sessionId, mapId, key);
    }
    refresh();
  }

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
        ref={canvasRef}
        data-testid="map-canvas"
        width={1000}
        height={1000}
        onClick={handleMapClick}
        style={{ cursor: paintMode ? 'crosshair' : 'default' }}
      />
    </div>
  );
}
