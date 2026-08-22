import { resolveMarkerVisibility, type VisibilityContext } from './map-marker-visibility';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

// M15-S07 (#279): layer/token projection into the player export.
export interface LayerData {
  id: string;
  layer_type: string;
  visible: number;
  player_visible: number;
  asset_id?: string | null;
  mask_data?: string | null;
  opacity?: number;
  z_order?: number;
}

export interface TokenData {
  id: string;
  layer_id: string;
  label: string | null;
  entity_id: string | null;
  counters_json: string;
  status_chips_json: string;
  x: number;
  y: number;
}

export interface GenerateParams {
  map: MapData;
  markers?: MarkerData[];
  context: VisibilityContext;
  layers?: LayerData[];
  tokens?: TokenData[];
  /** entity_id -> title, for token name fallback + escaping. */
  entityTitles?: Record<string, string>;
}

interface ChipLike { icon: string; color?: string; text?: string }
interface CounterLike { label: string; value: number; color?: string }

// AP-006 exception: JSON.parse of DB *_json -> safe fallback [].
function parseJsonArray<T>(json: string): T[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function generatePlayerMapHtml({ map, markers = [], context, layers = [], tokens = [], entityTitles = {} }: GenerateParams): string {
  const visibleMarkers = markers.filter(m =>
    resolveMarkerVisibility({ visibility: m.visibility, entity_id: m.entity_id, condition: m.condition }, context) !== 'hidden'
  );

  // Only player_visible layers reach the player; a fog layer additionally must
  // still be visible (visible=0 = the DM revealed it -> no cover exported).
  const exportedLayers = layers.filter(l =>
    l.player_visible === 1 && (l.layer_type !== 'fog' || l.visible === 1)
  );
  const playerTokenLayerIds = new Set(
    exportedLayers.filter(l => l.layer_type === 'token').map(l => l.id)
  );
  const exportedTokens = tokens.filter(tk => playerTokenLayerIds.has(tk.layer_id));

  function escJson(obj: unknown): string {
    // Embed JSON safely inside <script>: escape every '<' to its JS unicode
    // form. Neutralizes ALL </script variants (the HTML parser closes a script
    // at "</script" + space/tab/newline/>/, not only "</script>"), so a raw
    // '<' from user data can never break out of the payload. Renders identically.
    return JSON.stringify(obj).replace(/</g, '\\u003c');
  }

  function tokenName(tk: TokenData): string {
    return tk.label || (tk.entity_id ? entityTitles[tk.entity_id] : '') || 'Token';
  }

  const markersJson = escJson(visibleMarkers.map(m => ({
    id: m.id,
    kind: m.kind,
    label: m.label_text,
    geometry: JSON.parse(m.geometry_json),
  })));

  const markerListHtml = visibleMarkers.map(m =>
    `<li data-marker-id="${escapeHtml(m.id)}">${escapeHtml(m.label_text)}</li>`
  ).join('\n');

  const layerListHtml = exportedLayers.map(l =>
    `<li data-layer-id="${escapeHtml(l.id)}" data-layer-type="${escapeHtml(l.layer_type)}"></li>`
  ).join('\n');

  const tokenListHtml = exportedTokens.map(tk => {
    const chips = parseJsonArray<ChipLike>(tk.status_chips_json)
      .map(c => `<span class="token-chip" title="${escapeHtml(c.text ?? c.icon)}">${escapeHtml(c.icon)}</span>`)
      .join('');
    const counters = parseJsonArray<CounterLike>(tk.counters_json)
      .map(c => `<span class="token-counter" title="${escapeHtml(c.label)}">${escapeHtml(String(c.value))}</span>`)
      .join('');
    return `<li data-token-id="${escapeHtml(tk.id)}" data-x="${tk.x}" data-y="${tk.y}"><span class="token-name">${escapeHtml(tokenName(tk))}</span>${counters}${chips}</li>`;
  }).join('\n');

  const tokensJson = escJson(exportedTokens.map(tk => ({
    id: tk.id,
    name: tokenName(tk),
    x: tk.x,
    y: tk.y,
    counters: parseJsonArray<CounterLike>(tk.counters_json),
    status_chips: parseJsonArray<ChipLike>(tk.status_chips_json),
  })));

  const layersJson = escJson(exportedLayers.map(l => ({
    id: l.id, layer_type: l.layer_type, opacity: l.opacity ?? 1, z_order: l.z_order ?? 0,
  })));

  return `<!DOCTYPE html>
<html>
<head><title>${escapeHtml(map.title)}</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data: asset:">
<style>body{margin:0;font-family:sans-serif}#map{position:relative;display:inline-block}</style>
</head>
<body>
<h1>${escapeHtml(map.title)}</h1>
<div id="map" data-width="${map.image_width_px}" data-height="${map.image_height_px}">
  <ul id="layers">${layerListHtml}</ul>
  <ul id="markers">${markerListHtml}</ul>
  <ul id="tokens">${tokenListHtml}</ul>
</div>
<script>
var mapData = ${escJson({ id: map.id, title: map.title, width: map.image_width_px, height: map.image_height_px })};
var markers = ${markersJson};
var layers = ${layersJson};
var tokens = ${tokensJson};
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
