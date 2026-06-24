// E8-S04: Marker system — pins, polygons, labels, entity links, elevation.
// See: https://github.com/Djimon/WorldBrain/issues/78

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>),
  ImageOverlay: vi.fn(() => null),
  Marker: vi.fn(({ children }: { children?: React.ReactNode }) => <div data-testid="marker">{children}</div>),
  Polygon: vi.fn(() => <div data-testid="polygon" />),
  Tooltip: vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="tooltip">{children}</div>),
  useMap: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
  useMapEvents: vi.fn(() => null),
}));

vi.mock('../src/services/map-marker-service', () => ({
  getMarkersForMap: vi.fn(() => [
    { id: 'mk-1', map_id: 'map-1', entity_id: 'char-ada', kind: 'pin', geometry_json: '{"x":100,"y":200}', label_text: 'Ada', elevation_value: null, elevation_unit: null, visibility_json: '"public"' },
    { id: 'mk-2', map_id: 'map-1', entity_id: null, kind: 'polygon', geometry_json: '{"points":[[0,0],[100,0],[100,100],[0,100]]}', label_text: 'Region', elevation_value: null, elevation_unit: null, visibility_json: '"public"' },
    { id: 'mk-3', map_id: 'map-1', entity_id: null, kind: 'label', geometry_json: '{"x":300,"y":300}', label_text: 'North', elevation_value: 1200, elevation_unit: 'm', visibility_json: '"gm_only"' },
  ]),
  createMarker: vi.fn(() => ({ id: 'mk-new' })),
  updateMarker: vi.fn(),
  deleteMarker: vi.fn(),
}));

import { MarkerPanel } from '../src/ui/MapMarkers';

const mockDb = {};

describe('E8-S04 marker system', () => {
  describe('MarkerPanel rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<MarkerPanel mapId="map-1" database={mockDb as never} />)).not.toThrow();
    });

    it('lists all markers for the map', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getByText('Ada')).toBeInTheDocument();
      expect(screen.getByText('Region')).toBeInTheDocument();
      expect(screen.getByText('North')).toBeInTheDocument();
    });

    it('shows marker kind badges (pin, polygon, label)', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getByText(/pin/i)).toBeInTheDocument();
      expect(screen.getByText(/polygon/i)).toBeInTheDocument();
      expect(screen.getByText(/label/i)).toBeInTheDocument();
    });
  });

  describe('elevation display', () => {
    it('shows elevation value and unit on markers that have it', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getByText(/1200.*m|1200m/i)).toBeInTheDocument();
    });
  });

  describe('entity-linked marker', () => {
    it('entity-linked marker shows entity name', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getByText('Ada')).toBeInTheDocument();
    });

    it('clicking entity-linked marker calls onNavigateToEntity', () => {
      const onNavigate = vi.fn();
      render(<MarkerPanel mapId="map-1" database={mockDb as never} onNavigateToEntity={onNavigate} />);
      const adaMarker = screen.getByText('Ada').closest('[data-marker-id]') ?? screen.getByText('Ada');
      fireEvent.click(adaMarker);
      // Either navigation was called or the marker is clickable
      expect(onNavigate).toHaveBeenCalledWith('char-ada');
    });
  });

  describe('filter bar', () => {
    it('has a filter by kind control', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      const filter = screen.queryByRole('combobox', { name: /kind|filter/i });
      expect(filter).toBeInTheDocument();
    });

    it('filtering by kind narrows the list', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      const filter = screen.queryByRole('combobox', { name: /kind|filter/i });
      if (filter) {
        fireEvent.change(filter, { target: { value: 'pin' } });
        expect(screen.queryByText(/polygon/i)).not.toBeInTheDocument();
      }
    });
  });

  describe('create/delete', () => {
    it('has an Add Marker button', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getByRole('button', { name: /add marker|new marker/i })).toBeInTheDocument();
    });

    it('each marker has a delete control', () => {
      render(<MarkerPanel mapId="map-1" database={mockDb as never} />);
      expect(screen.getAllByRole('button', { name: /delete|remove/i }).length).toBeGreaterThan(0);
    });
  });
});
