// Movable image layers (beyond #275): image layers carry offset_x/offset_y and
// can be dragged on the map to place several maps side by side (e.g. building
// floors) and reveal them one by one. Drag-only, no numeric input.
//
// AP-008 (RTL): anchored queries. AP-001: DatabaseLike, no unknown casts.

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---- MapViewer drag persists the new offset --------------------------------

const IMG_LAYER = { id: 'img1', map_id: 'map-1', layer_type: 'image', name: 'Etage 1', asset_id: 'e1.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, offset_x: 0, offset_y: 0, created_at: '' };
const updateLayerMock = vi.hoisted(() => vi.fn(async () => {}));

vi.mock('../src/services/map-layer-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-layer-service')>();
  return { ...actual, listLayers: vi.fn(async () => [IMG_LAYER]), updateLayer: updateLayerMock };
});
vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(async () => ({ id: 'map-1', title: 'T', image_width_px: 1000, image_height_px: 800, calibration_json: null })),
  listMaps: vi.fn(async () => []), importMapImage: vi.fn(async () => ({ id: 'map-1' })),
  createMap: vi.fn(async () => ({ id: 'map-1' })), loadGridSettings: vi.fn(async () => null),
  saveGridSettings: vi.fn(async () => undefined), getAssetUrl: vi.fn((a: string) => `/assets/${a}`),
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

// eslint-disable-next-line import/first
import { MapViewer } from '../src/ui/MapViewer';
// eslint-disable-next-line import/first
import { LayerPanel } from '../src/ui/LayerPanel';

const mockDb = { execute: vi.fn(), select: vi.fn() };

describe('MapViewer move-layer drag', () => {
  it('dragging the layer image in move mode persists the new offset via updateLayer', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} moveLayerId="img1" />);
    const img = await screen.findByAltText('Etage 1');
    expect(img.style.pointerEvents).toBe('auto');
    fireEvent.pointerDown(img, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(img, { clientX: 130, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(img, { clientX: 130, clientY: 60, pointerId: 1 });
    expect(updateLayerMock).toHaveBeenCalledWith(mockDb, 'img1', { offset_x: 120, offset_y: 50 });
  });

  it('is not draggable when not in move mode', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const img = await screen.findByAltText('Etage 1');
    expect(img.style.pointerEvents).toBe('none');
  });
});

describe('LayerPanel move button', () => {
  it('shows a move button on an image layer and toggles it via onMoveLayer', async () => {
    const onMoveLayer = vi.fn();
    const { container } = render(<LayerPanel database={mockDb as never} mapId="map-1" onMoveLayer={onMoveLayer} />);
    const row = await waitFor(() => {
      const el = container.querySelector('[data-layer-id="img1"]');
      if (!el) throw new Error('row not rendered');
      return el as HTMLElement;
    });
    fireEvent.click(within(row).getByRole('button', { name: /^details$/i })); // rows default collapsed
    fireEvent.click(within(row).getByRole('button', { name: /^verschieben$/i }));
    expect(onMoveLayer).toHaveBeenCalledWith('img1');
  });
});
