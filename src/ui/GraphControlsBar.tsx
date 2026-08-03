import { useTranslation } from 'react-i18next';

export interface GraphControlsBarProps {
  mode: 'galaxy' | 'ring';
  showMentions: boolean;
  glowEnabled: boolean;
  nodeSizeScale: number;
  spreadScale: number;
  onModeChange: (mode: 'galaxy' | 'ring') => void;
  onShowMentionsChange: (show: boolean) => void;
  onGlowChange: (glow: boolean) => void;
  onNodeSizeScaleChange: (v: number) => void;
  onSpreadScaleChange: (v: number) => void;
}

export function GraphControlsBar({
  mode, showMentions, glowEnabled, nodeSizeScale, spreadScale,
  onModeChange, onShowMentionsChange, onGlowChange,
  onNodeSizeScaleChange, onSpreadScaleChange,
}: GraphControlsBarProps): React.ReactElement {
  const { t } = useTranslation('nav');

  return (
    <div className="graph-controls-bar" role="toolbar">
      <div className="graph-controls-bar__modes">
        <button onClick={() => onModeChange('galaxy')} aria-pressed={mode === 'galaxy'}>
          {t('graphModeGalaxy', 'Galaxy')}
        </button>
        <button onClick={() => onModeChange('ring')} aria-pressed={mode === 'ring'}>
          {t('graphModeRing', 'Ring')}
        </button>
      </div>

      <button onClick={() => onShowMentionsChange(!showMentions)} aria-pressed={showMentions}>
        {t('graphShowMentions', 'Verlinkungen')}
      </button>
      <button onClick={() => onGlowChange(!glowEnabled)} aria-pressed={glowEnabled}>
        {t('graphGlow', 'Glow')}
      </button>

      <label className="graph-controls-bar__slider">
        {t('graphNodeSize', 'Knotengröße')}
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.1}
          value={nodeSizeScale}
          onChange={(e) => onNodeSizeScaleChange(parseFloat(e.target.value))}
          aria-label={t('graphNodeSize', 'Knotengröße')}
        />
        <span>{nodeSizeScale.toFixed(1)}×</span>
      </label>

      <label className="graph-controls-bar__slider">
        {t('graphSpread', 'Spreizung')}
        <input
          type="range"
          min={0.4}
          max={2.5}
          step={0.1}
          value={spreadScale}
          onChange={(e) => onSpreadScaleChange(parseFloat(e.target.value))}
          aria-label={t('graphSpread', 'Spreizung')}
        />
        <span>{spreadScale.toFixed(1)}×</span>
      </label>

      <div className="graph-controls-bar__legend">
        <span className="graph-controls-bar__legend-relation">
          {t('graphLegendRelation', 'Relation (dick)')}
        </span>
        <span className="graph-controls-bar__legend-mention">
          {t('graphLegendMention', 'Verlinkung (dünn)')}
        </span>
      </div>
    </div>
  );
}
