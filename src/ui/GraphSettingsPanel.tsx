// M16-S03 (#324): graph settings, opened by a small gear icon at the bottom
// right of the graph view. Controlled component — GlobalGraphView owns the
// state and passes value + onChange. AP-003 (no prompt/alert), i18n via
// useTranslation with inline German defaults. Styling: graph.css (.gv-*).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EdgeForm } from './GraphCanvas';

export interface GraphSettings {
  // galaxy = 3D force layout (default); ring = flat 2D disc (S05 #290). The
  // toggle lives top-right in GlobalGraphView, not in this gear panel.
  layoutMode: 'galaxy' | 'ring';
  colorMode: 'entity' | 'cluster';
  glow: boolean;
  showAllEdges: boolean;
  showMentions: boolean;
  mentionColor: string;   // hex, e.g. "#ff3b30"
  relationColor: string;  // hex
  mentionForm: EdgeForm;
  relationForm: EdgeForm;
  // relation_type values whose edges are hidden (filter pane). Persisted;
  // stays hidden even when showAllEdges is on.
  hiddenRelationTypes: string[];
  // Ring/Disc only: node distribution inside each wedge + disc spacing knob.
  ringFill: 'organic' | 'ordered';
  ringSpacing: number; // multiplier on the auto disc size (bigger = more room)
}

export interface GraphSettingsPanelProps {
  value: GraphSettings;
  onChange: (patch: Partial<GraphSettings>) => void;
}

export function GraphSettingsPanel({ value, onChange }: GraphSettingsPanelProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [open, setOpen] = useState(false);

  const forms: EdgeForm[] = ['solid', 'dashed', 'animated'];
  const formLabel = (f: EdgeForm) =>
    f === 'solid' ? t('graphFormSolid', 'durchgezogen')
      : f === 'dashed' ? t('graphFormDashed', 'gestrichelt')
        : t('graphFormAnimated', 'animiert');

  return (
    <div className="gv-gear-wrap">
      {open && (
        <div className="gv-panel" role="group" aria-label={t('graphSettings', 'Graph-Einstellungen')}>
          <strong>{t('graphSettings', 'Graph-Einstellungen')}</strong>

          <div className="gv-field">
            <span className="gv-field__label">{t('graphColorMode', 'Farb-Modus')}</span>
            <div className="gv-segbar">
              {(['entity', 'cluster'] as const).map((m) => (
                <button
                  key={m}
                  className="gv-segbar__btn"
                  onClick={() => onChange({ colorMode: m })}
                  aria-pressed={value.colorMode === m}
                >{m === 'entity' ? t('graphColorEntity', 'nach Entity') : t('graphColorCluster', 'nach Cluster')}</button>
              ))}
            </div>
          </div>

          <label className="gv-check">
            <input type="checkbox" checked={value.glow} onChange={(e) => onChange({ glow: e.target.checked })} />
            {t('graphGlow', 'Glow')}
          </label>
          <label className="gv-check">
            <input type="checkbox" checked={value.showAllEdges} onChange={(e) => onChange({ showAllEdges: e.target.checked })} />
            {t('graphShowAllEdges', 'Alle Kanten zeigen')}
          </label>
          <label className="gv-check">
            <input type="checkbox" checked={value.showMentions} onChange={(e) => onChange({ showMentions: e.target.checked })} />
            {t('graphShowMentions', 'Mentions zeigen')}
          </label>

          <label className="gv-row">
            {t('graphMentionColor', 'Mention-Farbe')}
            <input type="color" value={value.mentionColor} onChange={(e) => onChange({ mentionColor: e.target.value })} />
          </label>
          <label className="gv-row">
            {t('graphRelationColor', 'Relation-Farbe')}
            <input type="color" value={value.relationColor} onChange={(e) => onChange({ relationColor: e.target.value })} />
          </label>

          <label className="gv-field">
            <span className="gv-field__label">{t('graphMentionForm', 'Mention-Form')}</span>
            <select value={value.mentionForm} onChange={(e) => onChange({ mentionForm: e.target.value as EdgeForm })}>
              {forms.map((f) => <option key={f} value={f}>{formLabel(f)}</option>)}
            </select>
          </label>
          <label className="gv-field">
            <span className="gv-field__label">{t('graphRelationForm', 'Relation-Form')}</span>
            <select value={value.relationForm} onChange={(e) => onChange({ relationForm: e.target.value as EdgeForm })}>
              {forms.map((f) => <option key={f} value={f}>{formLabel(f)}</option>)}
            </select>
          </label>

          {value.layoutMode === 'ring' && (
            <>
              <div className="gv-field">
                <span className="gv-field__label">{t('graphRingFill', 'Disc: Verteilung')}</span>
                <div className="gv-segbar">
                  {(['organic', 'ordered'] as const).map((m) => (
                    <button
                      key={m}
                      className="gv-segbar__btn"
                      onClick={() => onChange({ ringFill: m })}
                      aria-pressed={value.ringFill === m}
                    >{m === 'organic' ? t('graphRingFillOrganic', 'organisch') : t('graphRingFillOrdered', 'geordnet')}</button>
                  ))}
                </div>
              </div>
              <label className="gv-field">
                <span className="gv-field__label">{t('graphRingSpacing', 'Disc: Abstand')} ({value.ringSpacing.toFixed(1)}x)</span>
                <input
                  type="range" min={0.5} max={3} step={0.1} value={value.ringSpacing}
                  onChange={(e) => onChange({ ringSpacing: Number(e.target.value) })}
                />
              </label>
            </>
          )}
        </div>
      )}

      <button
        className="gv-gear"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('graphSettings', 'Graph-Einstellungen')}
        aria-expanded={open}
      >⚙</button>
    </div>
  );
}

export default GraphSettingsPanel;
