// M16-S03 (#324): relation-type filter. A funnel button (next to the settings
// gear, bottom right) opens a wide bottom pane listing every relation_type in
// the graph as a checkbox. Unchecking hides those relation edges — stays
// hidden even with "show all edges" on. Button turns red when anything is
// hidden. Controlled component; GlobalGraphView owns the hidden set (persisted).
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface GraphFilterPanelProps {
  types: string[];            // all relation_type values present (dynamic)
  hidden: string[];           // currently hidden
  onToggle: (type: string) => void;
  onSetAll: (hidden: string[]) => void;
}

const PANEL_BG = 'rgba(20,24,30,0.96)';

export function GraphFilterPanel({ types, hidden, onToggle, onSetAll }: GraphFilterPanelProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [open, setOpen] = useState(false);
  const active = hidden.length > 0;

  return (
    <>
      {open && (
        <div
          role="group"
          aria-label={t('graphFilter', 'Filter')}
          style={{
            position: 'absolute', left: 0, right: 0, bottom: 64, zIndex: 5,
            padding: '12px 16px', background: PANEL_BG, color: '#e8eef5',
            borderTop: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(4px)',
            maxHeight: '40%', overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <strong style={{ fontSize: 13 }}>{t('graphFilterRelationTypes', 'Relationstypen')}</strong>
            <button onClick={() => onSetAll([])} style={btn}>{t('graphFilterAll', 'Alle')}</button>
            <button onClick={() => onSetAll([...types])} style={btn}>{t('graphFilterNone', 'Keine')}</button>
            {types.length === 0 && <span style={{ opacity: 0.6, fontSize: 12 }}>{t('graphFilterEmpty', 'Keine Relationstypen im Graph')}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {types.map((tp) => (
              <label key={tp} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
                <input type="checkbox" checked={!hidden.includes(tp)} onChange={() => onToggle(tp)} />
                {tp}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('graphFilter', 'Filter')}
        aria-expanded={open}
        title={t('graphFilter', 'Filter')}
        style={{
          position: 'absolute', right: 64, bottom: 16, zIndex: 5,
          width: 40, height: 40, borderRadius: 20, cursor: 'pointer', fontSize: 18, lineHeight: 1,
          background: PANEL_BG, border: '1px solid rgba(255,255,255,0.15)',
          color: active ? '#f0716a' : '#e8eef5',
        }}
      >⧩</button>
    </>
  );
}

const btn: React.CSSProperties = {
  padding: '2px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
  border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eef5',
};

export default GraphFilterPanel;
