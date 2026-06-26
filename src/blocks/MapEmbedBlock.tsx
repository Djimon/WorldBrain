import { useState, useEffect } from 'react';
import { MapContainer, ImageOverlay } from 'react-leaflet';
import { getMap, getAssetUrl } from '../services/map-service';
import type { DatabaseLike } from '../services/entity-service';
import type { MapRow } from '../services/map-service';

interface Props {
  mapId: string;
  database?: DatabaseLike;
}

export function MapEmbedBlock({ mapId, database }: Props) {
  const [map, setMap] = useState<MapRow | null>(null);
  useEffect(() => {
    if (mapId && database) getMap(database, mapId).then(setMap);
  }, [mapId, database]);

  if (!mapId) {
    return <div>No map selected</div>;
  }

  if (!map) {
    return <div>Map not found</div>;
  }

  const url = getAssetUrl(map.asset_id);
  const bounds: [[number, number], [number, number]] = [[0, 0], [map.image_height_px, map.image_width_px]];

  return (
    <div>
      <h4>{map.title}</h4>
      <MapContainer crs={{ Simple: {} } as unknown as Parameters<typeof MapContainer>[0]['crs']} bounds={bounds} style={{ height: '300px', width: '100%' }}>
        <ImageOverlay url={url} bounds={bounds} />
      </MapContainer>
    </div>
  );
}
