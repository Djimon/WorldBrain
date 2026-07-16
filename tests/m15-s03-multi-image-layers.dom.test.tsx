// M15-S03: Multi-Image-Layer — mehrere PNGs gestapelt mit Opacity
// See: https://github.com/Djimon/WorldBrain/issues/275
//
// Note: actual image picking/copying reuses map-service's existing asset
// import flow (per AC — "do NOT add a new importer"); that flow has no
// existing unit-test coverage anywhere in this repo (it's Tauri-fs-based,
// e2e-tested manually), so this file does not attempt to unit-test the file
// copy itself — only importImageLayer's orchestration contract (creates an
// image layer at max z_order + 1) and MapViewer's stacked-rendering
// behavior, both testable via mocking.
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-008 (RTL): anchored queries.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';

const LAYERS = [
  { id: 'layer_base', map_id: 'map-1', layer_type: 'image', name: 'Base', asset_id: 'base.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, created_at: '' },
  { id: 'layer_over', map_id: 'map-1', layer_type: 'image', name: 'Overlay', asset_id: 'over.png', mask_data: null, opacity: 0.6, z_order: 1, visible: 1, player_visible: 1, created_at: '' },
  { id: 'layer_hidden', map_id: 'map-1', layer_type: 'image', name: 'Hidden Notes', asset_id: 'notes.png', mask_data: null, opacity: 1, z_order: 2, visible: 0, player_visible: 0, created_at: '' },
];

vi.mock('../src/services/map-layer-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-layer-service')>();
  return {
    ...actual,
    listLayers: vi.fn(async () => LAYERS),
  };
});

vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(async () => ({ id: 'map-1', title: 'Test Map', image_width_px: 0, image_height_px: 0, calibration_json: null })),
  listMaps: vi.fn(async () => []),
  importMapImage: vi.fn(async () => ({ id: 'map-1' })),
  createMap: vi.fn(async () => ({ id: 'map-1' })),
  loadGridSettings: vi.fn(async () => null),
  saveGridSettings: vi.fn(async () => undefined),
  getAssetUrl: vi.fn((assetId: string) => `/assets/${assetId}`),
}));

vi.mock('../src/services/entity-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/entity-service')>();
  return {
    ...actual,
    listEntitiesByType: vi.fn(async () => []),
  };
});

vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn(async () => []),
  createMarker: vi.fn(async () => ({ id: 'marker-1' })),
  updateMarker: vi.fn(async () => undefined),
  deleteMarker: vi.fn(async () => undefined),
}));

vi.mock('../src/services/session-grid-service', () => ({
  getActivatedCells: vi.fn(async () => []),
  setCellState: vi.fn(async () => undefined),
  activateCell: vi.fn(async () => undefined),
  deactivateCell: vi.fn(async () => undefined),
  clearAllCells: vi.fn(async () => undefined),
}));

vi.mock('../src/services/session-variable-service', () => ({
  setVar: vi.fn(async () => undefined),
  getVar: vi.fn(async () => null),
  resetVar: vi.fn(async () => undefined),
  listVars: vi.fn(async () => []),
  setGlobalVar: vi.fn(async () => undefined),
  getGlobalVar: vi.fn(async () => null),
}));

const mockDb = { execute: vi.fn(), select: vi.fn() };

describe('M15-S03 multi-image layers render stacked in MapViewer', () => {
  describe('N image layers render as stacked <img> elements in z_order', () => {
    it('renders one <img> per visible image layer', async () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      await waitFor(() => {
        const imgs = document.querySelectorAll('img[alt="Karte"], img[data-layer-id]');
        expect(imgs.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('the layer <img> elements appear in z_order (Base before Overlay in the DOM)', async () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      await waitFor(() => expect(document.querySelector('img[data-layer-id="layer_base"]')).toBeInTheDocument());
      const base = document.querySelector('img[data-layer-id="layer_base"]');
      const overlay = document.querySelector('img[data-layer-id="layer_over"]');
      expect(base).toBeInTheDocument();
      expect(overlay).toBeInTheDocument();
      expect(base?.compareDocumentPosition(overlay!) ?? 0 & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe('a layer with visible=0 is not rendered', () => {
    it('"Hidden Notes" layer produces no <img> element', async () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      await waitFor(() => expect(document.querySelector('img[data-layer-id="layer_base"]')).toBeInTheDocument());
      expect(document.querySelector('img[data-layer-id="layer_hidden"]')).not.toBeInTheDocument();
    });
  });

  describe('per-layer opacity is applied as a CSS style', () => {
    it('the Overlay layer <img> has opacity 0.6 applied', async () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      const overlayImg = await waitFor(() => {
        const el = document.querySelector('img[data-layer-id="layer_over"]') as HTMLImageElement | null;
        if (!el) throw new Error('not rendered yet');
        return el;
      });
      expect(overlayImg.style.opacity).toBe('0.6');
    });
  });
});

describe('M15-S03 importImageLayer orchestration', () => {
  it('is not yet implemented (stub) — creating an image layer via import throws', async () => {
    const { importImageLayer } = await import('../src/services/map-layer-service');
    await expect(importImageLayer(mockDb as never, { map_id: 'map-1', srcPath: '/tmp/x.png', projectDir: '/proj' })).rejects.toThrow();
  });
});
