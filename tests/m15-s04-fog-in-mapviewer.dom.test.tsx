// #276: fog layers must render as <canvas> overlays inside MapViewer's
// transform container (above image layers), a hidden fog layer must not render,
// and selecting a fog layer for editing shows the fog toolbar and makes that
// layer's canvas interactive. Complements the isolated component tests in
// m15-s04-fog-layer.dom.test.tsx by pinning the MapViewer wiring.
//
// AP-008 (RTL): anchored queries. AP-001: DatabaseLike, no unknown casts.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';

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
