// M15-S04: Fog-Layer & Paint-Tools — Toolbar (#276)
// Brush (size + feather) / rectangle shape, reveal/cover mode. Pure controls
// component — no canvas/paint logic here (that's FogMaskCanvas.tsx).
import { useTranslation } from 'react-i18next';

export type FogToolMode = 'reveal' | 'cover';
// brush = round dab, square = rectangular dab (both paint while dragging),
// region = drag corner-to-corner to fill a rectangle.
export type FogToolShape = 'brush' | 'square' | 'region';

export interface FogToolsProps {
  brushSize: number;
  feather: number;
  mode: FogToolMode;
  shape: FogToolShape;
  onBrushSizeChange: (size: number) => void;
  onFeatherChange: (feather: number) => void;
  onModeChange: (mode: FogToolMode) => void;
  onShapeChange: (shape: FogToolShape) => void;
}

export function FogTools({
  brushSize, feather, mode, shape,
  onBrushSizeChange, onFeatherChange, onModeChange, onShapeChange,
}: FogToolsProps) {
  const { t } = useTranslation();
  return (
    <div className="fog-tools">
      <div className="fog-tools__group">
        <button type="button" className={`fog-tools__btn${shape === 'brush' ? ' active' : ''}`}
          aria-pressed={shape === 'brush'} onClick={() => onShapeChange('brush')}>
          {t('fog.brush', 'Pinsel')}
        </button>
        <button type="button" className={`fog-tools__btn${shape === 'square' ? ' active' : ''}`}
          aria-pressed={shape === 'square'} onClick={() => onShapeChange('square')}>
          {t('fog.square', 'Rechteck')}
        </button>
        <button type="button" className={`fog-tools__btn${shape === 'region' ? ' active' : ''}`}
          aria-pressed={shape === 'region'} onClick={() => onShapeChange('region')}>
          {t('fog.region', 'Bereich')}
        </button>
      </div>

      <div className="fog-tools__group">
        <button type="button" className={`fog-tools__btn${mode === 'reveal' ? ' active' : ''}`}
          aria-pressed={mode === 'reveal'} onClick={() => onModeChange('reveal')}>
          {t('fog.reveal', 'Aufdecken')}
        </button>
        <button type="button" className={`fog-tools__btn${mode === 'cover' ? ' active' : ''}`}
          aria-pressed={mode === 'cover'} onClick={() => onModeChange('cover')}>
          {t('fog.cover', 'Verdecken')}
        </button>
      </div>

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
    </div>
  );
}

export default FogTools;
