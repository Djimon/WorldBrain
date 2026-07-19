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
import type { ReactNode } from 'react';

export interface MapsSidebarTabsProps {
  selectedMapId: string | null;
  mapsTabContent: ReactNode;
  layersTabContent: ReactNode;
}

export function MapsSidebarTabs(_props: MapsSidebarTabsProps): never {
  throw new Error('not implemented');
}
