// M5-S10: Map image import & viewer — Canvas 2D API, no map framework.
// See: https://github.com/Djimon/WorldBrain/issues/76

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapList } from '../src/ui/MapViewer';

vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(() => ({ id: 'map-1', title: 'World Map', asset_id: 'asset-1', image_width_px: 6000, image_height_px: 4200, calibration_json: null })),
  listMaps: vi.fn(() => [
    { id: 'map-1', title: 'World Map', asset_id: 'asset-1', image_width_px: 6000, image_height_px: 4200 },
    { id: 'map-2', title: 'City Map', asset_id: 'asset-2', image_width_px: 2000, image_height_px: 1500 },
  ]),
  getAssetUrl: vi.fn((assetId: string) => `/assets/${assetId}.png`),
}));

import { MapViewer } from '../src/ui/MapViewer';

const mockDb = {};

describe('M5-S10 map viewer', () => {
  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<MapViewer mapId="map-1" database={mockDb as never} />)).not.toThrow();
    });

    it('renders a <canvas> element — not a Leaflet container', () => {
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} />);
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });

    it('does not render a react-leaflet map-container testid', () => {
      render(<MapViewer mapId="map-1" database={mockDb as never} />);
      expect(screen.queryByTestId('map-container')).toBeNull();
    });

    it('canvas has correct pixel dimensions from map data', () => {
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} />);
      const canvas = container.querySelector('canvas');
      // Canvas must be sized to the map image dimensions (or scaled variant)
      expect(Number(canvas?.getAttribute('width') ?? canvas?.width)).toBeGreaterThan(0);
      expect(Number(canvas?.getAttribute('height') ?? canvas?.height)).toBeGreaterThan(0);
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
    it('MapList component renders all maps', () => {
      render(<MapList database={mockDb as never} onSelectMap={vi.fn()} />);
      expect(screen.getByText('World Map')).toBeInTheDocument();
      expect(screen.getByText('City Map')).toBeInTheDocument();
    });

    it('clicking a map calls onSelectMap with mapId', () => {
      const onSelect = vi.fn();
      render(<MapList database={mockDb as never} onSelectMap={onSelect} />);
      fireEvent.click(screen.getByText('World Map'));
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
    it('renders coordinate display on mousemove over canvas', () => {
      const { container } = render(<MapViewer mapId="map-1" database={mockDb as never} showCoordinates />);
      const canvas = container.querySelector('canvas')!;
      fireEvent.mouseMove(canvas, { clientX: 100, clientY: 80 });
      // Coordinate display must appear somewhere in the component after hover
      const coord = container.querySelector('[data-coordinates], [aria-label*="coordinate"], [role="tooltip"]')
        ?? screen.queryByText(/px|coordinate|\d+\s*,\s*\d+/i);
      expect(coord).toBeInTheDocument();
    });
  });
});
