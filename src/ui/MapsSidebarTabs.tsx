// chore(maps): Layer-Panel als Reiter in der Sidebar (Karten/Ebenen) (#297)
// UX refinement of the Maps sidebar: "Karten"/"Ebenen" tabs instead of the
// list + LayerPanel stacked in the same column. Selecting a map auto-jumps
// to "Ebenen"; "Karten" switches back manually without clearing selection.
//
// Assumption (undocumented in AC): mounting this inside WorkspaceShell.tsx's
// maps-area (currently the stacked list + maps-layer-section, ~line 402) is
// Implementation Agent wiring — WorkspaceShell has no existing render-test
// harness anywhere in this repo (needs useDatabase() context plus a dozen
// live-project services), same reasoning as the M14-S06 (#261) and M14-S13
// (#268) scope notes. This component owns and is tested for the actual tab
// behavior the AC requires.
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs } from './primitives';

export interface MapsSidebarTabsProps {
  selectedMapId: string | null;
  mapsTabContent: ReactNode;
  layersTabContent: ReactNode;
  /** When set, the sidebar can collapse to a vertical label strip (like Pins/Token). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

type Tab = 'maps' | 'layers';

export function MapsSidebarTabs({ selectedMapId, mapsTabContent, layersTabContent, collapsed = false, onToggleCollapse }: MapsSidebarTabsProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<Tab>('maps');
  const prevMapId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedMapId !== prevMapId.current) {
      setActiveTab(selectedMapId ? 'layers' : 'maps');
      prevMapId.current = selectedMapId;
    }
  }, [selectedMapId]);

  if (collapsed) {
    return (
      <div className="maps-sidebar-tabs maps-sidebar-tabs--collapsed">
        <div className="map-side-collapsed">
          <button type="button" className="map-side-collapsed__tab"
            onClick={() => { setActiveTab('maps'); onToggleCollapse?.(); }}>
            {t('mapsSidebarTabs.maps', 'Karten')}
          </button>
          <button type="button" className="map-side-collapsed__tab" disabled={!selectedMapId}
            onClick={() => { if (selectedMapId) setActiveTab('layers'); onToggleCollapse?.(); }}>
            {t('mapsSidebarTabs.layers', 'Ebenen')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="maps-sidebar-tabs">
      <div className="maps-sidebar-tabs__list">
        <Tabs
          fill
          label={t('mapsSidebarTabs.label', 'Karten und Ebenen')}
          activeId={activeTab}
          onSelect={(id) => setActiveTab(id as Tab)}
          options={[
            { id: 'maps', label: t('mapsSidebarTabs.maps', 'Karten') },
            { id: 'layers', label: t('mapsSidebarTabs.layers', 'Ebenen'), disabled: !selectedMapId },
          ]}
        />
        {onToggleCollapse && (
          <button type="button" className="map-side-collapse-btn" title={t('collapse', 'Einklappen')}
            onClick={onToggleCollapse}>◀</button>
        )}
      </div>
      <div className="maps-sidebar-tabs__panel">
        {activeTab === 'maps' ? mapsTabContent : layersTabContent}
      </div>
    </div>
  );
}
