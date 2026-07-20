// M15-S07/#298/#301: Token render — a single token in the map's CSS-transform
// container, above pins. A token is a map-local design element (NO entity
// link). Its art comes from an uploaded image:
//   render_style 'token' -> image in a round mask + colored frame; the crop is
//                           pannable via art_offset_x/y (percent, objectPosition).
//   render_style 'plain' -> the full artwork, no mask (monster/encounter art).
// No art yet -> initial-letter placeholder. Presentational only; drag/persist
// is wired by MapViewer. Base size scales scale(1/mapScale) like pins to stay
// legible, multiplied by the token's own `scale` (#301).
import type { MapTokenRow } from '../services/map-token-service';

export interface MapTokenProps {
  token: MapTokenRow;
  /** Current map zoom (the token counter-scales by 1/scale, times its own scale). */
  scale: number;
  selected?: boolean;
  /** Resolves an asset id to a src URL (getAssetUrl). Omitted in pure tests. */
  resolveAssetUrl?: (assetId: string) => string;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSelect?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Mouse-down on the resize handle (only shown when selected) -> MapViewer scales. */
  onResizeStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const DEFAULT_RING = 'var(--color-accent, #6ea8fe)';

export function tokenName(token: MapTokenRow): string {
  return token.label || 'Token';
}

export function MapToken({
  token, scale, selected = false, resolveAssetUrl,
  onPointerDown, onPointerMove, onPointerUp, onSelect, onResizeStart,
}: MapTokenProps) {
  const name = tokenName(token);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const ring = token.ring_color || DEFAULT_RING;
  const artSrc = token.art_asset_id && resolveAssetUrl ? resolveAssetUrl(token.art_asset_id) : null;
  const objectPosition = `${50 + token.art_offset_x}% ${50 + token.art_offset_y}%`;
  const tokenScale = token.scale || 1;

  return (
    <div
      data-token-id={token.id}
      data-render-style={token.render_style}
      className={`map-token map-token--${token.render_style}${selected ? ' map-token--selected' : ''}`}
      style={{
        position: 'absolute',
        left: token.x,
        top: token.y,
        transform: `scale(${tokenScale / scale}) translate(-50%, -50%)`,
        transformOrigin: '50% 50%',
      }}
      // Stop the mousedown from reaching the map container (which would start a
      // pan while dragging the token — #301). Pointer events drive the drag.
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onClick={onSelect}
    >
      {token.status_chips.length > 0 && (
        <div className="map-token__chips">
          {token.status_chips.map((chip, i) => (
            <span
              key={`${chip.icon}-${i}`}
              className="map-token__chip"
              style={chip.color ? { color: chip.color } : undefined}
              title={chip.text || chip.icon}
            >
              {chip.icon}
            </span>
          ))}
        </div>
      )}

      {token.render_style === 'plain' && artSrc ? (
        <img className="map-token__art-plain" src={artSrc} alt={name} draggable={false} />
      ) : (
        <div className="map-token__ring" style={{ borderColor: ring }}>
          {artSrc ? (
            <img
              className="map-token__art"
              src={artSrc}
              alt={name}
              draggable={false}
              style={{ objectFit: 'cover', width: '100%', height: '100%', objectPosition }}
            />
          ) : (
            <div className="map-token__portrait" style={{ background: ring }}>{initial}</div>
          )}
        </div>
      )}

      {token.counter_value != null && (
        <span className="map-token__counter" title={token.counter_label || undefined}>
          {token.counter_value}
        </span>
      )}
      <span className="map-token__name">{name}</span>

      {selected && (
        <div
          className="map-token__resize"
          title="Größe ziehen"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart?.(e); }}
        />
      )}
    </div>
  );
}

export default MapToken;
