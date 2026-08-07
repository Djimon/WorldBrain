// M16-S03 (#324): graph settings, opened by a small gear icon at the bottom
// right of the graph view. Controlled component — GlobalGraphView owns the
// state and passes value + onChange. AP-003 (no prompt/alert), i18n via
// useTranslation with inline German defaults.
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

const PANEL_BG = 'rgba(20,24,30,0.94)';

export function GraphSettingsPanel({ value, onChange }: GraphSettingsPanelProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [open, setOpen] = useState(false);

  const forms: EdgeForm[] = ['solid', 'dashed', 'animated'];
  const formLabel = (f: EdgeForm) =>
    f === 'solid' ? t('graphFormSolid', 'durchgezogen')
      : f === 'dashed' ? t('graphFormDashed', 'gestrichelt')
        : t('graphFormAnimated', 'animiert');

  return (
    <div style={{ position: 'absolute', right: 16, bottom: 16, zIndex: 5, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
      {open && (
        <div role="group" aria-label={t('graphSettings', 'Graph-Einstellungen')} style={{
          width: 260, padding: '12px 14px', background: PANEL_BG, borderRadius: 10,
          border: '1px solid rgba(255,255,255,0.1)', color: '#e8eef5', fontSize: 13,
          display: 'flex', flexDirection: 'column', gap: 10, backdropFilter: 'blur(4px)',
        }}>
          <strong>{t('graphSettings', 'Graph-Einstellungen')}</strong>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ opacity: 0.75, fontSize: 11 }}>{t('graphColorMode', 'Farb-Modus')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['entity', 'cluster'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ colorMode: m })}
                  aria-pressed={value.colorMode === m}
                  style={{
                    flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', color: '#e8eef5',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: value.colorMode === m ? '#3a6ea5' : 'transparent',
                  }}
                >{m === 'entity' ? t('graphColorEntity', 'nach Entity') : t('graphColorCluster', 'nach Cluster')}</button>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={value.glow} onChange={(e) => onChange({ glow: e.target.checked })} />
            {t('graphGlow', 'Glow')}
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={value.showAllEdges} onChange={(e) => onChange({ showAllEdges: e.target.checked })} />
            {t('graphShowAllEdges', 'Alle Kanten zeigen')}
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={value.showMentions} onChange={(e) => onChange({ showMentions: e.target.checked })} />
            {t('graphShowMentions', 'Mentions zeigen')}
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            {t('graphMentionColor', 'Mention-Farbe')}
            <input type="color" value={value.mentionColor} onChange={(e) => onChange({ mentionColor: e.target.value })} />
          </label>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            {t('graphRelationColor', 'Relation-Farbe')}
            <input type="color" value={value.relationColor} onChange={(e) => onChange({ relationColor: e.target.value })} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ opacity: 0.75, fontSize: 11 }}>{t('graphMentionForm', 'Mention-Form')}</span>
            <select value={value.mentionForm} onChange={(e) => onChange({ mentionForm: e.target.value as EdgeForm })}>
              {forms.map((f) => <option key={f} value={f}>{formLabel(f)}</option>)}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={{ opacity: 0.75, fontSize: 11 }}>{t('graphRelationForm', 'Relation-Form')}</span>
            <select value={value.relationForm} onChange={(e) => onChange({ relationForm: e.target.value as EdgeForm })}>
              {forms.map((f) => <option key={f} value={f}>{formLabel(f)}</option>)}
            </select>
          </label>

          {value.layoutMode === 'ring' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ opacity: 0.75, fontSize: 11 }}>{t('graphRingFill', 'Disc: Verteilung')}</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['organic', 'ordered'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => onChange({ ringFill: m })}
                      aria-pressed={value.ringFill === m}
                      style={{
                        flex: 1, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', color: '#e8eef5',
                        border: '1px solid rgba(255,255,255,0.15)',
                        background: value.ringFill === m ? '#3a6ea5' : 'transparent',
                      }}
                    >{m === 'organic' ? t('graphRingFillOrganic', 'organisch') : t('graphRingFillOrdered', 'geordnet')}</button>
                  ))}
                </div>
              </div>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ opacity: 0.75, fontSize: 11 }}>{t('graphRingSpacing', 'Disc: Abstand')} ({value.ringSpacing.toFixed(1)}x)</span>
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
        onClick={() => setOpen((o) => !o)}
        aria-label={t('graphSettings', 'Graph-Einstellungen')}
        aria-expanded={open}
        style={{
          width: 40, height: 40, borderRadius: 20, cursor: 'pointer', fontSize: 20, lineHeight: 1,
          background: PANEL_BG, border: '1px solid rgba(255,255,255,0.15)', color: '#e8eef5',
        }}
      >⚙</button>
    </div>
  );
}

export default GraphSettingsPanel;
