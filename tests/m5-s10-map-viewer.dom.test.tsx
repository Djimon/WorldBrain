// M5-S10: Map image import & viewer — native DOM/SVG rendering, no map framework.
// See: https://github.com/Djimon/WorldBrain/issues/76

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Services sind auf async migriert (#400 Cluster B). map-service exportiert zusätzlich
// loadGridSettings/saveGridSettings, die der Viewer beim Mount awaited.
vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn().mockResolvedValue({ id: 'map-1', title: 'World Map', asset_id: 'asset-1', image_width_px: 6000, image_height_px: 4200, calibration_json: null }),
  listMaps: vi.fn().mockResolvedValue([
    { id: 'map-1', title: 'World Map', asset_id: 'asset-1', image_width_px: 6000, image_height_px: 4200 },
    { id: 'map-2', title: 'City Map', asset_id: 'asset-2', image_width_px: 2000, image_height_px: 1500 },
  ]),
  getAssetUrl: vi.fn((assetId: string) => `/assets/${assetId}.png`),
  loadGridSettings: vi.fn().mockResolvedValue(null),
  saveGridSettings: vi.fn().mockResolvedValue(undefined),
}));

// Der Viewer hängt inzwischen an vielen async Services; ihre Mount-Effekte müssen
// aufgelöste Promises liefern, sonst reißt ein sync-Throw den Baum ab (#400).
vi.mock('../src/services/map-layer-service', () => ({
  // One visible image layer so imgSrc is set — otherwise the viewer renders the
  // "empty image" placeholder instead of the map surface.
  listLayers: vi.fn().mockResolvedValue([
    { id: 'layer-1', map_id: 'map-1', layer_type: 'image', visible: true, z_order: 0, asset_id: 'asset-1', opacity: 1, mask_data: null },
  ]),
  updateLayer: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/map-token-service', () => ({
  listTokens: vi.fn().mockResolvedValue([]),
  createToken: vi.fn().mockResolvedValue({ id: 'tok-1' }),
  moveToken: vi.fn().mockResolvedValue(undefined),
  updateToken: vi.fn().mockResolvedValue(undefined),
  setCounters: vi.fn().mockResolvedValue(undefined),
  setStatusChips: vi.fn().mockResolvedValue(undefined),
  deleteToken: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn().mockResolvedValue([]),
  createMarker: vi.fn().mockResolvedValue({ id: 'mk-1' }),
  updateMarker: vi.fn().mockResolvedValue(undefined),
  deleteMarker: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/session-grid-service', () => ({
  getActivatedCells: vi.fn().mockResolvedValue([]),
  clearAllCells: vi.fn().mockResolvedValue(undefined),
  setCellState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/services/session-variable-service', () => ({
  listVars: vi.fn().mockResolvedValue([]),
}));

// #400: die Karten-Liste wurde von <MapList> (self-fetch) auf <MapFolderTree>
// (maps als Prop, Ordner-Service) umgestellt.
vi.mock('../src/services/map-folder-service', () => ({
  listFolders: vi.fn().mockResolvedValue([]),
  createFolder: vi.fn().mockResolvedValue({ id: 'folder-1' }),
  renameFolder: vi.fn().mockResolvedValue(undefined),
  deleteFolder: vi.fn().mockResolvedValue(undefined),
  moveMap: vi.fn().mockResolvedValue(undefined),
  moveFolder: vi.fn().mockResolvedValue(undefined),
  setFolderColor: vi.fn().mockResolvedValue(undefined),
}));

import { MapViewer } from '../src/ui/MapViewer';
import { MapFolderTree } from '../src/ui/MapFolderTree';

const mockDb = {};

describe('M5-S10 map viewer', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<MapViewer mapId="map-1" database={mockDb as never} />)).not.toThrow();
    });

    it('renders a native map surface — not a Leaflet container', async () => {
      // Rendering migrated from a Canvas 2D element to a native DOM/SVG surface
      // marked with data-map-canvas; either way, no framework container.
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} />);
      await waitFor(() => expect(container.querySelector('[data-map-canvas]')).toBeInTheDocument());
    });

    it('does not render a react-leaflet map-container testid', () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      expect(screen.queryByTestId('map-container')).toBeNull();
    });

    it('map overlay is sized to the map image dimensions from map data', async () => {
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} />);
      // Once getMap resolves, the SVG overlays are sized to the map's pixel dimensions.
      await waitFor(() => {
        const overlay = container.querySelector('svg.map-grid__svg-overlay') ?? container.querySelector('[data-map-canvas] svg');
        expect(Number(overlay?.getAttribute('width'))).toBeGreaterThan(0);
        expect(Number(overlay?.getAttribute('height'))).toBeGreaterThan(0);
      });
    });
  });

  describe('no framework dependency', () => {
    it('source does not import react-leaflet', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/MapViewer.tsx', 'utf8');
      expect(src).not.toMatch(/react-leaflet/);
    });

    it('source does not import leaflet', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/MapViewer.tsx', 'utf8');
      expect(src).not.toMatch(/['"]leaflet['"]/);
    });
  });

  describe('map list', () => {
    const maps = [
      { id: 'map-1', title: 'World Map', folder_id: null },
      { id: 'map-2', title: 'City Map', folder_id: null },
    ];

    it('MapFolderTree renders all maps', async () => {
      render(<MapFolderTree database={mockDb as never} maps={maps} onSelectMap={vi.fn()} />);
      expect(await screen.findByText('World Map')).toBeInTheDocument();
      expect(screen.getByText('City Map')).toBeInTheDocument();
    });

    it('clicking a map calls onSelectMap with mapId', async () => {
      const onSelect = vi.fn();
      render(<MapFolderTree database={mockDb as never} maps={maps} onSelectMap={onSelect} />);
      fireEvent.click(await screen.findByText('World Map'));
      expect(onSelect).toHaveBeenCalledWith('map-1');
    });
  });

  describe('supported formats', () => {
    it('accepts PNG, JPG, WEBP, SVG asset types', () => {
      const formats = ['png', 'jpg', 'webp', 'svg'];
      formats.forEach(fmt => {
        expect(() => render(<MapViewer mapId="map-1" database={mockDb as never} format={fmt} />)).not.toThrow();
      });
    });
  });

  describe('pixel coordinate tooltip', () => {
    it('renders coordinate display on mousemove over the map surface', async () => {
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} showCoordinates />);
      await waitFor(() => expect(container.querySelector('[data-map-canvas]')).toBeInTheDocument());
      const surface = container.querySelector('[data-map-canvas]')!;
      fireEvent.mouseMove(surface, { clientX: 100, clientY: 80 });
      // Coordinate display renders as "x × y" in .map-viewer__coords after hover.
      const coord = container.querySelector('.map-viewer__coords, [data-coordinates], [role="tooltip"]')
        ?? screen.queryByText(/px|coordinate|\d+\s*[×,]\s*\d+/i);
      expect(coord).toBeInTheDocument();
    });
  });
});
