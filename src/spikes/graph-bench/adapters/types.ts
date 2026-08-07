import type { BenchModel } from '../model';
import type { LayoutPosition } from '../layoutWorker';

export type PositionMap = Map<string, LayoutPosition>;

export interface AdapterOptions {
  width: number;
  height: number;
  glow: boolean;
  // called once per rendered frame with the current timestamp (ms) so the
  // harness can compute fps uniformly across all engines.
  onFrame: (nowMs: number) => void;
}

export interface RendererHandle {
  setGlow(on: boolean): void;
  resize(width: number, height: number): void;
  dispose(): void;
  // Glow feasibility note for the verdict (e.g. "native bloom" vs "custom shader").
  glowNote: string;
}

// Every engine adapter is this one shape. The harness mounts exactly one at a
// time into the same container with the same model+positions.
export type RendererAdapter = (
  container: HTMLElement,
  model: BenchModel,
  positions: PositionMap,
  opts: AdapterOptions,
) => Promise<RendererHandle> | RendererHandle;
