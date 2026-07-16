// M15-S02: Layer-Panel UI (#274)
// Reuses map-layer-service.ts (S01, #273) — no new persistence, only UI over
// the existing createLayer/listLayers/updateLayer/deleteLayer/reorderLayers.
//
// Assumption (undocumented in AC): reordering exposes accessible "move up"/
// "move down" buttons per row alongside the pointer-drag interaction named
// in the AC (reusing MapViewer's PinTree onPointerDown pattern). Simulating
// raw pointer-drag reliably in jsdom is impractical and the AC's own
// reorder requirement ("reorderLayers persists the new order") is fully
// covered by a keyboard/click-accessible affordance — drag remains an
// Implementation Agent addition on top, not a second code path.
import type { DatabaseLike } from '../services/entity-service';

export interface LayerPanelProps {
  database: DatabaseLike;
  mapId: string;
  onAddImageLayer?: () => void;
  onAddFogLayer?: () => void;
}

export function LayerPanel(_props: LayerPanelProps): never {
  throw new Error('not implemented');
}
