// M15-S04: Fog-Layer & Paint-Tools — Toolbar (#276)
// Brush (size + feather) / rectangle shape, reveal/cover mode. Pure controls
// component — no canvas/paint logic here (that's FogMaskCanvas.tsx).

export type FogToolMode = 'reveal' | 'cover';
export type FogToolShape = 'brush' | 'rectangle';

export interface FogToolsProps {
  brushSize: number;
  feather: number;
  mode: FogToolMode;
  shape: FogToolShape;
  onBrushSizeChange: (size: number) => void;
  onFeatherChange: (feather: number) => void;
  onModeChange: (mode: FogToolMode) => void;
  onShapeChange: (shape: FogToolShape) => void;
}

export function FogTools(_props: FogToolsProps): never {
  throw new Error('not implemented');
}
