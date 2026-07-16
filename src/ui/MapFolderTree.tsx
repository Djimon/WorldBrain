// M15-S05: Map-Ordnerbaum — verschachtelte Folders für Maps (#277)
// Reuses map-folder-service.ts — no new persistence.
//
// Assumption (undocumented in AC): alongside the pointer-drag +
// data-drop-path/elementFromPoint pattern named in the AC (PinTree's, which
// relies on document.elementFromPoint — unavailable in jsdom, no test
// precedent anywhere in this repo), this component also exposes an
// accessible "verschieben nach"/"ordner verschieben nach" select per row.
// That's the primary testable affordance here — same reasoning as M15-S02's
// move-up/move-down buttons alongside LayerPanel's drag requirement. Drag
// is an additional Implementation Agent affordance layered on top, not a
// second code path.
import type { DatabaseLike } from '../services/entity-service';

export interface MapFolderTreeMap {
  id: string;
  title: string;
  folder_id: string | null;
}

export interface MapFolderTreeProps {
  database: DatabaseLike;
  maps: MapFolderTreeMap[];
  onSelectMap?: (mapId: string) => void;
}

export function MapFolderTree(_props: MapFolderTreeProps): never {
  throw new Error('not implemented');
}
