// Bug: pin-tree folder-anchor markers (kind='folder-anchor', pure UI
// containers for the pin-tree's folder grouping) were rendered as real,
// clickable/draggable pins on the map canvas — visible as stray pins at
// whatever position their (meaningless) geometry_json happened to hold.
// Reported live via screenshot: two extra pins matching folder names
// ("Test2", "Test") sitting on the map. Folders must stay pure containers
// with no spatial representation.
//
// AP-008 (RTL): anchored queries.

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapViewer } from '../src/ui/MapViewer';

const MARKERS = [
  {
    id: 'folder-1', map_id: 'map-1', entity_id: null, kind: 'folder-anchor',
    geometry_json: '{"virtual":true}', style_json: '{}', visibility_json: '"public"',
    label_text: 'Test', group_name: 'Test', elevation_value: null, elevation_unit: null,
  },
  {
    id: 'pin-1', map_id: 'map-1', entity_id: null, kind: 'pin',
    geometry_json: '{"x":100,"y":100}', style_json: '{}', visibility_json: '"public"',
    label_text: 'Schatzinsel', group_name: null, elevation_value: null, elevation_unit: null,
  },
];

vi.mock('../src/services/map-layer-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-layer-service')>();
  return {
    ...actual,
    listLayers: vi.fn(async () => [
      { id: 'layer_base', map_id: 'map-1', layer_type: 'image', name: 'Base', asset_id: 'base.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, created_at: '' },
    ]),
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
  return { ...actual, listEntitiesByType: vi.fn(async () => []) };
});

vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn(async () => MARKERS),
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

describe('folder-anchor markers are pure pin-tree containers, not map pins', () => {
  it('renders exactly one .map-pin element (the real pin, not the folder-anchor)', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(document.querySelectorAll('.map-pin').length).toBe(1));
  });

  it('the "Pins (N)" header excludes folder-anchor rows from its count', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(screen.getByText(/^Pins \(1\)$/)).toBeInTheDocument());
  });
});
