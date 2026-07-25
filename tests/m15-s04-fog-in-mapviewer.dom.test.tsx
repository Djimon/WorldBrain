// #276: fog layers must render as <canvas> overlays inside MapViewer's
// transform container (above image layers), a hidden fog layer must not render,
// and selecting a fog layer for editing shows the fog toolbar and makes that
// layer's canvas interactive. Complements the isolated component tests in
// m15-s04-fog-layer.dom.test.tsx by pinning the MapViewer wiring.
//
// AP-008 (RTL): anchored queries. AP-001: DatabaseLike, no unknown casts.

import type { ComponentProps } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';
import { FogMaskCanvas } from '../src/ui/FogMaskCanvas';

const LAYERS = [
  { id: 'img1', map_id: 'map-1', layer_type: 'image', name: 'Base', asset_id: 'base.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, created_at: '' },
  { id: 'fog1', map_id: 'map-1', layer_type: 'fog', name: 'Nebel', asset_id: null, mask_data: 'data:image/png;base64,AAAA', opacity: 1, z_order: 1, visible: 1, player_visible: 0, created_at: '' },
  { id: 'fog_hidden', map_id: 'map-1', layer_type: 'fog', name: 'Alter Nebel', asset_id: null, mask_data: 'data:image/png;base64,BBBB', opacity: 1, z_order: 2, visible: 0, player_visible: 0, created_at: '' },
];

vi.mock('../src/services/map-layer-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-layer-service')>();
  return { ...actual, listLayers: vi.fn(async () => LAYERS), updateLayer: vi.fn(async () => {}) };
});
vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(async () => ({ id: 'map-1', title: 'Test', image_width_px: 1000, image_height_px: 800, calibration_json: null })),
  listMaps: vi.fn(async () => []),
  importMapImage: vi.fn(async () => ({ id: 'map-1' })),
  createMap: vi.fn(async () => ({ id: 'map-1' })),
  loadGridSettings: vi.fn(async () => null),
  saveGridSettings: vi.fn(async () => undefined),
  getAssetUrl: vi.fn((a: string) => `/assets/${a}`),
}));
vi.mock('../src/services/entity-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/entity-service')>();
  return { ...actual, listEntitiesByType: vi.fn(async () => []) };
});
vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn(async () => []), createMarker: vi.fn(async () => ({ id: 'm' })),
  updateMarker: vi.fn(async () => undefined), deleteMarker: vi.fn(async () => undefined),
}));
vi.mock('../src/services/session-grid-service', () => ({
  getActivatedCells: vi.fn(async () => []), setCellState: vi.fn(async () => undefined),
  activateCell: vi.fn(async () => undefined), deactivateCell: vi.fn(async () => undefined), clearAllCells: vi.fn(async () => undefined),
}));
vi.mock('../src/services/session-variable-service', () => ({
  setVar: vi.fn(async () => undefined), getVar: vi.fn(async () => null), resetVar: vi.fn(async () => undefined),
  listVars: vi.fn(async () => []), setGlobalVar: vi.fn(async () => undefined), getGlobalVar: vi.fn(async () => null),
}));

const mockDb = { execute: vi.fn(), select: vi.fn() };

describe('M15-S04 fog layers in MapViewer', () => {
  it('renders a fog canvas for each visible fog layer, above the image layers', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const fog = await waitFor(() => {
      const el = document.querySelector('canvas[data-fog-layer-id="fog1"]');
      if (!el) throw new Error('fog canvas not rendered');
      return el as HTMLElement;
    });
    // above the base image in DOM order
    const baseImg = document.querySelector('img[data-layer-id="img1"]');
    expect(baseImg).toBeInTheDocument();
    expect(!!(baseImg!.compareDocumentPosition(fog) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('does not render a hidden (visible=0) fog layer', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(document.querySelector('canvas[data-fog-layer-id="fog1"]')).toBeInTheDocument());
    expect(document.querySelector('canvas[data-fog-layer-id="fog_hidden"]')).not.toBeInTheDocument();
  });

  it('shows the fog toolbar and makes the selected layer interactive when editing', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} editFogLayerId="fog1" />);
    const fog = await waitFor(() => {
      const el = document.querySelector('canvas[data-fog-layer-id="fog1"]') as HTMLElement | null;
      if (!el) throw new Error('fog canvas not rendered');
      return el;
    });
    expect(screen.getByRole('slider', { name: /^pinselgröße$/i })).toBeInTheDocument();
    expect(fog.style.pointerEvents).toBe('auto');
  });

  it('does not show the fog toolbar when no fog layer is being edited', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(document.querySelector('canvas[data-fog-layer-id="fog1"]')).toBeInTheDocument());
    expect(screen.queryByRole('slider', { name: /^pinselgröße$/i })).not.toBeInTheDocument();
  });
});

// #314 (bugfix): the reload useEffect in FogMaskCanvas.tsx currently depends
// on [maskData, imgW, imgH]. Since MapViewer's optimistic setFogLayers changes
// the maskData prop right after the component's own stroke, this effect
// re-fires and re-decodes the ~2MB mask it just painted itself — the "flash".
// Fix direction (per issue): depend on [layerId, imgW, imgH] instead, so the
// canvas reloads on layer switch/mount, not on every maskData change.
//
// jsdom has no real canvas 2D backend (getContext returns null), so we mock
// HTMLCanvasElement.prototype.getContext to make the effect body (which is
// gated behind `if (!ctx) return`) actually observable via a clearRect spy —
// this is the only way to prove the effect re-ran without depending on the
// [FOGDBG] debug logs, which the issue itself mandates removing once fixed.
describe('#314 (bugfix): reload-on-own-stroke flash', () => {
  let clearRectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearRectSpy = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      clearRect: clearRectSpy,
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function baseProps(overrides: Partial<ComponentProps<typeof FogMaskCanvas>> = {}) {
    return {
      layerId: 'fog1', maskData: 'data:image/png;base64,AAAA', imgW: 1000, imgH: 800,
      mode: 'reveal' as const, shape: 'brush' as const, brushSize: 20, feather: 5,
      active: true, onStrokeEnd: vi.fn(),
      ...overrides,
    };
  }

  it('AC 1: a new maskData value for the SAME layerId (own stroke echoed back) does not reload the canvas', () => {
    const { rerender } = render(<FogMaskCanvas {...baseProps()} />);
    expect(clearRectSpy).toHaveBeenCalledTimes(1); // initial mount reload
    rerender(<FogMaskCanvas {...baseProps({ maskData: 'data:image/png;base64,BBBB' })} />);
    expect(clearRectSpy).toHaveBeenCalledTimes(1); // no additional reload — this is the flash bug
  });

  it('AC 2: switching layerId still reloads the newly selected layer\'s mask, even with the same maskData value', () => {
    const { rerender } = render(<FogMaskCanvas {...baseProps({ layerId: 'fogA', maskData: 'data:image/png;base64,SAME' })} />);
    expect(clearRectSpy).toHaveBeenCalledTimes(1);
    rerender(<FogMaskCanvas {...baseProps({ layerId: 'fogB', maskData: 'data:image/png;base64,SAME' })} />);
    expect(clearRectSpy).toHaveBeenCalledTimes(2); // layer switch must still reload
  });
});
