import { useState, useEffect } from 'react';
import { getMap, getAssetUrl } from '../services/map-service';
import type { DatabaseLike } from '../services/entity-service';
import type { MapRow } from '../services/map-service';

interface Props {
  mapId: string;
  database?: DatabaseLike;
}

// #291: migrated off react-leaflet onto the MapViewer track — plain <img>,
// no pan/zoom interactivity here (this is a static preview embed, not the
// full interactive viewer).
export function MapEmbedBlock({ mapId, database }: Props) {
  const [map, setMap] = useState<MapRow | null>(null);
  useEffect(() => {
    if (mapId && database) getMap(database, mapId).then(setMap).catch(console.error);
  }, [mapId, database]);

  if (!mapId) {
    return <div>No map selected</div>;
  }

  if (!map) {
    return <div>Map not found</div>;
  }

  const url = getAssetUrl(map.asset_id);

  return (
    <div className="map-embed-block">
      <h4>{map.title}</h4>
      <div className="map-embed-block__frame" style={{ height: '300px', width: '100%' }}>
        <img
          src={url}
          alt={map.title}
          className="map-embed-block__img"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />
      </div>
    </div>
  );
}
