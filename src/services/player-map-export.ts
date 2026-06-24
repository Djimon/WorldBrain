import { resolveMarkerVisibility, type VisibilityContext } from './map-marker-visibility';

export interface MapData {
  id: string;
  title: string;
  asset_id: string;
  image_width_px: number;
  image_height_px: number;
  calibration_json: string | null;
}

export interface MarkerData {
  id: string;
  map_id: string;
  kind: string;
  geometry_json: string;
  label_text: string;
  entity_id: string | null;
  visibility: string;
  condition?: unknown;
}

export interface GenerateParams {
  map: MapData;
  markers: MarkerData[];
  context: VisibilityContext;
}

export function generatePlayerMapHtml({ map, markers, context }: GenerateParams): string {
  const visibleMarkers = markers.filter(m =>
    resolveMarkerVisibility({ visibility: m.visibility, entity_id: m.entity_id, condition: m.condition }, context) !== 'hidden'
  );

  const markersJson = JSON.stringify(visibleMarkers.map(m => ({
    id: m.id,
    kind: m.kind,
    label: m.label_text,
    geometry: JSON.parse(m.geometry_json),
  })));

  const markerListHtml = visibleMarkers.map(m =>
    `<li data-marker-id="${m.id}">${m.label_text}</li>`
  ).join('\n');

  return `<!DOCTYPE html>
<html>
<head><title>${map.title}</title>
<style>body{margin:0;font-family:sans-serif}#map{position:relative;display:inline-block}</style>
</head>
<body>
<h1>${map.title}</h1>
<div id="map" data-width="${map.image_width_px}" data-height="${map.image_height_px}">
  <ul id="markers">${markerListHtml}</ul>
</div>
<script>
var mapData = ${JSON.stringify({ id: map.id, title: map.title, width: map.image_width_px, height: map.image_height_px })};
var markers = ${markersJson};
</script>
</body>
</html>`;
}

export function applyProgressiveReveal(
  markers: MarkerData[],
  options: { revealedEntityIds: string[] }
): MarkerData[] {
  const { revealedEntityIds } = options;
  return markers.filter(m => {
    if (m.visibility !== 'player_known') return true;
    if (!m.entity_id) return false;
    return revealedEntityIds.includes(m.entity_id);
  });
}
