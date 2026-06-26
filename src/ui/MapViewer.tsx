import { useState, useRef, useEffect } from 'react';
import { getMap, listMaps, getAssetUrl } from '../services/map-service';
import type { MapRow } from '../services/map-service';
import type { DatabaseLike } from '../services/entity-service';

interface Props {
  mapId: string;
  database: DatabaseLike;
  format?: string;
  showCoordinates?: boolean;
}

export function MapViewer({ mapId, database, format: _format, showCoordinates }: Props) {
  const [map, setMap] = useState<MapRow | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    getMap(database, mapId).then(setMap);
  }, [database, mapId]);

  useEffect(() => {
    if (!canvasRef.current || !map) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.src = getAssetUrl(map.asset_id);
    img.onload = () => ctx.drawImage(img, 0, 0, map.image_width_px, map.image_height_px);
  }, [map]);

  if (!map) return <div>Map not found</div>;

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!showCoordinates) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setCoords({ x: Math.round(e.clientX - rect.left), y: Math.round(e.clientY - rect.top) });
  }

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={map.image_width_px}
        height={map.image_height_px}
        onMouseMove={handleMouseMove}
        style={{ maxWidth: '100%' }}
      />
      {showCoordinates && coords && (
        <div data-coordinates role="tooltip">{coords.x}px, {coords.y}px</div>
      )}
    </div>
  );
}

export function MapList({ database, onSelectMap }: { database: DatabaseLike; onSelectMap: (mapId: string) => void }) {
  const [maps, setMaps] = useState<MapRow[]>([]);
  useEffect(() => {
    listMaps(database).then(setMaps);
  }, [database]);
  return (
    <ul>
      {maps.map((m) => (
        <li key={m.id}>
          <button onClick={() => onSelectMap(m.id)}>{m.title}</button>
        </li>
      ))}
    </ul>
  );
}

export default MapViewer;
