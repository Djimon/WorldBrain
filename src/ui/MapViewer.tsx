import { MapContainer, ImageOverlay } from 'react-leaflet';
import { getMap, listMaps, getAssetUrl } from '../services/map-service';

interface Props {
  mapId: string;
  database: unknown;
  format?: string;
  showCoordinates?: boolean;
}

export function MapViewer({ mapId, database, format: _format, showCoordinates: _showCoordinates }: Props) {
  const map = getMap(database as never, mapId);
  if (!map) return <div>Map not found</div>;

  const url = getAssetUrl(map.asset_id);
  const bounds: [[number, number], [number, number]] = [[0, 0], [map.image_height_px, map.image_width_px]];

  return (
    <MapContainer crs={{ Simple: {} } as never} bounds={bounds} style={{ height: '600px', width: '100%' }}>
      <ImageOverlay url={url} bounds={bounds} />
    </MapContainer>
  );
}

export function MapList({ database, onSelectMap }: { database: unknown; onSelectMap: (mapId: string) => void }) {
  const maps = listMaps(database as never);
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
