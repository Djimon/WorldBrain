// M16-S03 (#324): relation-type filter. A funnel button (next to the settings
// gear, bottom right) opens a wide bottom pane listing every relation_type in
// the graph as a checkbox. Unchecking hides those relation edges — stays
// hidden even with "show all edges" on. Button turns red when anything is
// hidden. Controlled component; GlobalGraphView owns the hidden set (persisted).
// Styling: graph.css (.gv-*), scoped under .graph-view.
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface GraphFilterPanelProps {
  types: string[];            // all relation_type values present (dynamic)
  hidden: string[];           // currently hidden
  onToggle: (type: string) => void;
  onSetAll: (hidden: string[]) => void;
}

export function GraphFilterPanel({ types, hidden, onToggle, onSetAll }: GraphFilterPanelProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [open, setOpen] = useState(false);
  const active = hidden.length > 0;

  return (
    <>
      {open && (
        <div className="gv-filter-pane" role="group" aria-label={t('graphFilter', 'Filter')}>
          <div className="gv-filter-pane__head">
            <strong className="gv-filter-pane__title">{t('graphFilterRelationTypes', 'Relationstypen')}</strong>
            <button className="gv-mini-btn" onClick={() => onSetAll([])}>{t('graphFilterAll', 'Alle')}</button>
            <button className="gv-mini-btn" onClick={() => onSetAll([...types])}>{t('graphFilterNone', 'Keine')}</button>
            {types.length === 0 && <span className="gv-muted">{t('graphFilterEmpty', 'Keine Relationstypen im Graph')}</span>}
          </div>
          <div className="gv-filter-pane__list">
            {types.map((tp) => (
              <label key={tp} className="gv-check--inline">
                <input type="checkbox" checked={!hidden.includes(tp)} onChange={() => onToggle(tp)} />
                {tp}
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        className={`gv-fab gv-fab--filter${active ? ' gv-fab--active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={t('graphFilter', 'Filter')}
        aria-expanded={open}
        title={t('graphFilter', 'Filter')}
      >⧩</button>
    </>
  );
}

export default GraphFilterPanel;
