// M15-S04: Fog-Layer & Paint-Tools — Toolbar (#276)
// Brush (size + feather) / rectangle shape, reveal/cover mode. Pure controls
// component — no canvas/paint logic here (that's FogMaskCanvas.tsx).
import { useTranslation } from 'react-i18next';
import { stampCellCount } from './fogStampGeometry';
import type { FogStampGridType, FogStampLevel } from './fogStampGeometry';
import { Segmented } from './primitives';

const STAMP_LEVELS: FogStampLevel[] = [0, 1, 2, 3, 4];

export type FogToolMode = 'reveal' | 'cover';
// brush = round dab, square = rectangular dab (both paint while dragging),
// region = drag corner-to-corner to fill a rectangle, grid-stamp = #295
// grid-aware cell stamp (only offered when a grid is active).
export type FogToolShape = 'brush' | 'square' | 'region' | 'grid-stamp';

export interface FogToolsProps {
  brushSize: number;
  feather: number;
  mode: FogToolMode;
  shape: FogToolShape;
  onBrushSizeChange: (size: number) => void;
  onFeatherChange: (feather: number) => void;
  onModeChange: (mode: FogToolMode) => void;
  onShapeChange: (shape: FogToolShape) => void;
  // #295: grid-aware fog stamp — only rendered when a grid is active
  // (gridActive === true). Not yet implemented (RED phase, TDD).
  gridActive?: boolean;
  gridType?: FogStampGridType;
  stampLevel?: FogStampLevel;
  onStampLevelChange?: (level: FogStampLevel) => void;
}

export function FogTools({
  brushSize, feather, mode, shape,
  onBrushSizeChange, onFeatherChange, onModeChange, onShapeChange,
  gridActive = false, gridType, stampLevel, onStampLevelChange,
}: FogToolsProps) {
  const { t } = useTranslation('map');
  return (
    <div className="fog-tools">
      <Segmented
        label={t('fog.shape', 'Form')}
        value={shape}
        onChange={(id) => onShapeChange(id as FogToolShape)}
        options={[
          { id: 'brush', label: t('fog.brush', 'Pinsel') },
          { id: 'square', label: t('fog.square', 'Rechteck') },
          { id: 'region', label: t('fog.region', 'Bereich') },
          ...(gridActive && gridType ? [{ id: 'grid-stamp', label: t('fog.gridStamp', 'Grid-Stempel') }] : []),
        ]}
      />

      {/* #295: size flyout, only when the grid stamp is the active shape —
          five levels, cell count is grid-type-specific (square vs. hex ring). */}
      {shape === 'grid-stamp' && gridActive && gridType && (
        <Segmented
          label={t('fog.stampSize', 'Stempelgröße')}
          value={String(stampLevel)}
          onChange={(id) => onStampLevelChange?.(Number(id) as FogStampLevel)}
          options={STAMP_LEVELS.map((level) => ({
            id: String(level),
            label: `${stampCellCount(level, gridType)} ${t('fog.cells', 'Zellen')}`,
          }))}
        />
      )}

      <Segmented
        label={t('fog.mode', 'Modus')}
        value={mode}
        onChange={(id) => onModeChange(id as FogToolMode)}
        options={[
          { id: 'reveal', label: t('fog.reveal', 'Aufdecken') },
          { id: 'cover', label: t('fog.cover', 'Verdecken') },
        ]}
      />

      {(shape === 'brush' || shape === 'square') && (
        <>
          <label className="fog-tools__slider">
            {t('fog.brushSize', 'Pinselgröße')}
            <input type="range" aria-label={t('fog.brushSize', 'Pinselgröße')}
              min={2} max={200} value={brushSize}
              onChange={(e) => onBrushSizeChange(Number(e.target.value))} />
            <span className="fog-tools__value">{brushSize}px</span>
          </label>

          <label className="fog-tools__slider">
            {t('fog.feather', 'Weichzeichnung')}
            <input type="range" aria-label={t('fog.feather', 'Weichzeichnung')}
              min={0} max={100} value={feather}
              onChange={(e) => onFeatherChange(Number(e.target.value))} />
            <span className="fog-tools__value">{feather}</span>
          </label>
        </>
      )}
    </div>
  );
}

export default FogTools;
