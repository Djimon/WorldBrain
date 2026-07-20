// M15-S07: Token render (#279) — a single token drawn in the map's
// CSS-transform container, above pins. Presentational only: portrait + ring +
// name pill + optional counter badge + status-chip arc. Drag/persist is wired
// by MapViewer (moveToken). Token size scales inversely with map zoom
// (scale(1/scale)) like pins, so it stays legible.
import type { MapTokenRow } from '../services/map-token-service';

export interface MapTokenProps {
  token: MapTokenRow;
  /** Resolved title of the linked entity (fallback name source when no label). */
  entityTitle?: string;
  scale: number;
  selected?: boolean;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSelect?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const DEFAULT_RING = 'var(--color-accent, #6ea8fe)';

export function tokenName(token: MapTokenRow, entityTitle?: string): string {
  return token.label || entityTitle || 'Token';
}

export function MapToken({
  token, entityTitle, scale, selected = false,
  onPointerDown, onPointerMove, onPointerUp, onSelect,
}: MapTokenProps) {
  const name = tokenName(token, entityTitle);
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const ring = token.ring_color || DEFAULT_RING;
  return (
    <div
      data-token-id={token.id}
      className={`map-token${selected ? ' map-token--selected' : ''}`}
      style={{
        position: 'absolute',
        left: token.x,
        top: token.y,
        transform: `scale(${1 / scale}) translate(-50%, -50%)`,
        transformOrigin: '50% 50%',
      }}
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
      <div className="map-token__ring" style={{ borderColor: ring }}>
        <div className="map-token__portrait" style={{ background: ring }}>{initial}</div>
      </div>
      {token.counter_value != null && (
        <span className="map-token__counter" title={token.counter_label || undefined}>
          {token.counter_value}
        </span>
      )}
      <span className="map-token__name">{name}</span>
    </div>
  );
}

export default MapToken;
