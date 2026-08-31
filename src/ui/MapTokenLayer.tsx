// M15-S07/#298/#301: Token render — a single token in the map's CSS-transform
// container, above pins. A token is a map-local design element (NO entity
// link). Its art comes from an uploaded image:
//   render_style 'token' -> image in a round mask + colored frame; the crop is
//                           pannable via art_offset_x/y (percent, objectPosition).
//   render_style 'plain' -> the full artwork, no mask (monster/encounter art).
// No art yet -> initial-letter placeholder. Presentational only; drag/persist
// is wired by MapViewer. Unlike pins, tokens do NOT counter-scale against map
// zoom — they have a fixed size relative to the map image, like a physical
// token on paper, and simply grow/shrink with it. Only the token's own
// `scale` (#301, the resize handle) changes its size.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Counter, MapTokenRow } from '../services/map-token-service';
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

// #300 "Chip-Rendering am Token": chips sit on a fixed circular orbit around
// the token — a constant angular step between neighbors, placed clockwise
// starting from the top. NOT resized dynamically by count: more chips just
// continue further around the same fixed-spacing orbit (wrapping past 360°
// is fine — CSS rotate() normalizes it visually).
const CHIP_ORBIT_STEP_DEG = 30;
function chipAngle(index: number): number {
  return index * CHIP_ORBIT_STEP_DEG;
}

export interface MapTokenProps {
  token: MapTokenRow;
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
  onCounterStep?: (index: number, delta: number) => void;
}

const DEFAULT_RING = 'var(--mode-accent, #6ea8fe)';

export function tokenName(token: MapTokenRow): string {
  return token.label || 'Token';
}

function CounterBadge({ counter, index, selected, onCounterStep }: {
  counter: Counter; index: number; selected: boolean;
  onCounterStep?: (index: number, delta: number) => void;
}) {
  const { t } = useTranslation('map');
  const [hover, setHover] = useState(false);
  const showStepper = hover || selected;
  const swallow = (e: React.SyntheticEvent) => e.stopPropagation();
  const bg = counter.color || 'var(--mode-accent, #6ea8fe)';
  return (
    <div className="map-token__counter" title={counter.label || undefined}
      style={{ background: bg }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {showStepper && counter.label && (
        <span className="map-token__counter-label">{counter.label}</span>
      )}
      <span className="map-token__counter-val">{counter.value}</span>
      {showStepper && (
        <div className="map-token__counter-steps">
          <button type="button" className="map-token__counter-btn" aria-label={t('token.counterIncrease')}
            onPointerDown={swallow} onMouseDown={swallow}
            onClick={(e) => { e.stopPropagation(); onCounterStep?.(index, 1); }}>+</button>
          <button type="button" className="map-token__counter-btn" aria-label={t('token.counterDecrease')}
            onPointerDown={swallow} onMouseDown={swallow}
            onClick={(e) => { e.stopPropagation(); onCounterStep?.(index, -1); }}>−</button>
        </div>
      )}
    </div>
  );
}

export function MapToken({
  token, selected = false, dragging = false, resolveAssetUrl,
  onPointerDown, onPointerMove, onPointerUp, onSelect, onResizeStart, onCounterStep,
}: MapTokenProps) {
  const { t } = useTranslation('map');
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
        transform: `scale(${tokenScale}) translate(-50%, -50%)`,
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
            // Base size lives purely in style.css (.map-token__chip font-size)
            // — no inline fontSize here. The token's own scale already applies
            // via the token root's `transform: scale(tokenScale)`, which this
            // whole chips container inherits; setting fontSize inline too
            // (even a fixed value) would still shadow whatever CSS says, so
            // CSS wouldn't be the source of truth.
            const angle = chipAngle(i);
            return (
              <span
                key={`${chip.icon}-${i}`}
                className="map-token__chip"
                style={{
                  color: chip.color || '#fff',
                  ...(token.render_style === 'token'
                    // rotate to the arc position, translate out, then
                    // counter-rotate back — keeps the glyph itself upright
                    // while its position still fans out along the arc.
                    ? { transform: `rotate(${angle}deg) translateY(-2em) rotate(${-angle}deg)` }
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
        {token.counters.length > 0 && (
          <div className="map-token__counters">
            {token.counters.map((c, i) => (
              <CounterBadge key={i} counter={c} index={i} selected={selected} onCounterStep={onCounterStep} />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div
          className="map-token__resize"
          title={t('token.resizeDrag')}
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
