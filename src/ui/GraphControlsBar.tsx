import { useTranslation } from 'react-i18next';

export interface GraphControlsBarProps {
  mode: 'galaxy' | 'ring';
  showMentions: boolean;
  glowEnabled: boolean;
  onModeChange: (mode: 'galaxy' | 'ring') => void;
  onShowMentionsChange: (show: boolean) => void;
  onGlowChange: (glow: boolean) => void;
}

export function GraphControlsBar({
  mode, showMentions, glowEnabled,
  onModeChange, onShowMentionsChange, onGlowChange,
}: GraphControlsBarProps): React.ReactElement {
  const { t } = useTranslation('nav');

  return (
    <div className="graph-controls-bar" role="toolbar">
      <button onClick={() => onModeChange('galaxy')} aria-pressed={mode === 'galaxy'}>
        {t('graphModeGalaxy', 'Galaxy')}
      </button>
      <button onClick={() => onModeChange('ring')} aria-pressed={mode === 'ring'}>
        {t('graphModeRing', 'Ring')}
      </button>
      <button onClick={() => onShowMentionsChange(!showMentions)} aria-pressed={showMentions}>
        {t('graphShowMentions', 'Verlinkungen')}
      </button>
      <button onClick={() => onGlowChange(!glowEnabled)} aria-pressed={glowEnabled}>
        {t('graphGlow', 'Glow')}
      </button>
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
