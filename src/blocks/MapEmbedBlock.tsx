import { MapContainer, ImageOverlay } from 'react-leaflet';
import { getMap, getAssetUrl } from '../services/map-service';

interface Props {
  mapId: string;
  database?: unknown;
}

export function MapEmbedBlock({ mapId, database }: Props) {
  if (!mapId) {
    return <div>No map selected</div>;
  }

  const map = getMap(database as never, mapId);
  if (!map) {
    return <div>Map not found</div>;
  }

  const url = getAssetUrl(map.asset_id);
  const bounds: [[number, number], [number, number]] = [[0, 0], [map.image_height_px, map.image_width_px]];

  return (
    <div>
      <h4>{map.title}</h4>
      <MapContainer crs={{ Simple: {} } as never} bounds={bounds} style={{ height: '300px', width: '100%' }}>
        <ImageOverlay url={url} bounds={bounds} />
      </MapContainer>
    </div>
  );
}
