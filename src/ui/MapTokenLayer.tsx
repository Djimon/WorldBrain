// M15-S07/#298/#301: Token render — a single token in the map's CSS-transform
// container, above pins. A token is a map-local design element (NO entity
// link). Its art comes from an uploaded image:
//   render_style 'token' -> image in a round mask + colored frame; the crop is
//                           pannable via art_offset_x/y (percent, objectPosition).
//   render_style 'plain' -> the full artwork, no mask (monster/encounter art).
// No art yet -> initial-letter placeholder. Presentational only; drag/persist
// is wired by MapViewer. Base size scales scale(1/mapScale) like pins to stay
// legible, multiplied by the token's own `scale` (#301).
import { useState } from 'react';
import type { MapTokenRow } from '../services/map-token-service';
import { getIcon } from '../services/icon-set-registry';

// #300: chip.icon may be a registry ref ("set_id:icon_key") or a legacy
// literal glyph string (no colon -> getIcon returns undefined, falls back
// to rendering the raw string as before — backward compatible).
function ChipGlyph({ icon }: { icon: string }) {
  const resolved = getIcon(icon);
  if (!resolved) return <>{icon}</>;
  if (resolved.svg) return <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: resolved.svg }} />;
  if (resolved.src) return <img src={resolved.src} alt="" aria-hidden="true" />;
  return <>{resolved.glyph}</>;
}

// #300 "Chip-Rendering am Token": chips fan out in an arc around the token
// (render_style='token'), growing toward a full circle as more chips are
// added instead of staying squeezed into a narrow arc.
function chipAngle(index: number, count: number): number {
  if (count <= 1) return 0;
  const span = Math.min(360, 55 * (count - 1));
  const step = span / (count - 1);
  return -span / 2 + step * index;
}

export interface MapTokenProps {
  token: MapTokenRow;
  /** Current map zoom (the token counter-scales by 1/scale, times its own scale). */
  scale: number;
  selected?: boolean;
  /** Transient drag state — shows the outline only, no stepper. */
  dragging?: boolean;
  /** Resolves an asset id to a src URL (getAssetUrl). Omitted in pure tests. */
  resolveAssetUrl?: (assetId: string) => string;
  onPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSelect?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Mouse-down on the resize handle (only shown when selected) -> MapViewer scales. */
  onResizeStart?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /** Inline counter step (+1 / -1) directly on the map, without the editor. */
  onCounterStep?: (delta: number) => void;
}

const DEFAULT_RING = 'var(--color-accent, #6ea8fe)';

export function tokenName(token: MapTokenRow): string {
  return token.label || 'Token';
}

export function MapToken({
  token, scale, selected = false, dragging = false, resolveAssetUrl,
  onPointerDown, onPointerMove, onPointerUp, onSelect, onResizeStart, onCounterStep,
}: MapTokenProps) {
  // Stepper + full label reveal only when hovering the counter itself (not the
  // whole token), or when the token is selected.
  const [counterHover, setCounterHover] = useState(false);
  const showStepper = counterHover || selected;
  // Stop drag/pan/select from firing when using an inline control (stepper/handle).
  const swallow = (e: React.SyntheticEvent) => e.stopPropagation();
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
      className={`map-token map-token--${token.render_style}${selected || dragging ? ' map-token--selected' : ''}`}
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
        <div className={`map-token__chips map-token__chips--${token.render_style === 'token' ? 'arc' : 'row'}`}>
          {token.status_chips.map((chip, i) => {
            // Fixed base size — the token's own scale already applies via the
            // token root's `transform: scale(tokenScale/mapScale)`, which this
            // whole chips container inherits. Multiplying fontSize by
            // tokenScale here too double-scales (grows faster than the token).
            const angle = chipAngle(i, token.status_chips.length);
            return (
              <span
                key={`${chip.icon}-${i}`}
                className="map-token__chip"
                style={{
                  color: chip.color || '#000',
                  fontSize: '12px',
                  ...(token.render_style === 'token'
                    // rotate to the arc position, translate out, then
                    // counter-rotate back — keeps the glyph itself upright
                    // while its position still fans out along the arc.
                    ? { transform: `rotate(${angle}deg) translateY(-0.8em) rotate(${-angle}deg)` }
                    : undefined),
                }}
                title={chip.text || chip.icon}
              >
                <ChipGlyph icon={chip.icon} />
              </span>
            );
          })}
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

      <div className="map-token__footer">
        <span className="map-token__name">{name}</span>
        {token.counter_value != null && (
          <div className="map-token__counter" title={token.counter_label || undefined}
          onMouseEnter={() => setCounterHover(true)} onMouseLeave={() => setCounterHover(false)}>
            {showStepper && token.counter_label && (
              <span className="map-token__counter-label">{token.counter_label}</span>
            )}
            <span className="map-token__counter-val">{token.counter_value}</span>
            {showStepper && (
              <div className="map-token__counter-steps">
                <button type="button" className="map-token__counter-btn" aria-label="Erhöhen"
                  onPointerDown={swallow} onMouseDown={swallow}
                  onClick={(e) => { e.stopPropagation(); onCounterStep?.(1); }}>+</button>
                <button type="button" className="map-token__counter-btn" aria-label="Verringern"
                  onPointerDown={swallow} onMouseDown={swallow}
                  onClick={(e) => { e.stopPropagation(); onCounterStep?.(-1); }}>−</button>
              </div>
            )}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="map-token__resize"
          title="Größe ziehen"
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart?.(e); }}
        >
          ⤡
        </div>
      )}
    </div>
  );
}

export default MapToken;
