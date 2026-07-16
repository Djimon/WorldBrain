// M15-S04: Fog-Layer & Paint-Tools — Paint-Oberfläche (#276)
// Renders the fog mask as a <canvas> overlay in the map's CSS-transform
// container, above image layers. Paints via pointer down/move/up in map
// coordinates (PaintInteractionLayer's existing pattern), NOT Leaflet.
// On stroke end, calls onStrokeEnd with the updated mask dataURL — the
// caller (MapViewer) persists it via updateLayer (debounce acceptable).

import type { FogToolMode, FogToolShape } from './FogTools';

export interface FogMaskCanvasProps {
  layerId: string;
  maskData: string | null;
  imgW: number;
  imgH: number;
  mode: FogToolMode;
  shape: FogToolShape;
  brushSize: number;
  feather: number;
  active: boolean;
  onStrokeEnd: (maskDataUrl: string) => void;
}

export function FogMaskCanvas(_props: FogMaskCanvasProps): never {
  throw new Error('not implemented');
}
