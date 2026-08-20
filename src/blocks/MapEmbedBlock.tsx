import { useState, useEffect } from 'react';
import { getMap, getAssetUrl } from '../services/map-service';
import { listLayers } from '../services/map-layer-service';
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
  const [baseAssetId, setBaseAssetId] = useState<string | null>(null);
  useEffect(() => {
    if (mapId && database) {
      getMap(database, mapId).then(setMap).catch(console.error);
      listLayers(database, mapId).then((layers) => {
        setBaseAssetId(layers.find((l) => l.layer_type === 'image')?.asset_id ?? null);
      }).catch(console.error);
    }
  }, [mapId, database]);

  if (!mapId) {
    return <div>No map selected</div>;
  }

  if (!map) {
    return <div>Map not found</div>;
  }

  const url = getAssetUrl(baseAssetId ?? '');

  return (
    <div className="map-embed-block">
      <h4>{map.title}</h4>
      <div className="map-embed-block__frame">
        <img
          src={url}
          alt={map.title}
          className="map-embed-block__img"
        />
      </div>
    </div>
  );
}
