// M5-S14: Session grid tracking mode — Canvas click events, paint mode, session-scoped state.
// See: https://github.com/Djimon/WorldBrain/issues/80

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/session-grid-service', () => ({
  getActivatedCells: vi.fn(() => [{ cell_key: '3:4', session_id: 'sess-1', activated_at: 0 }]),
  activateCell: vi.fn(),
  deactivateCell: vi.fn(),
  clearAllCells: vi.fn(),
}));

import { SessionGridTracker } from '../src/ui/SessionGridTracker';

const mockDb = {};

describe('M5-S14 session grid tracking', () => {
  describe('no framework dependency', () => {
    it('source does not import react-leaflet', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/SessionGridTracker.tsx', 'utf8');
      expect(src).not.toMatch(/react-leaflet/);
    });
  });

  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />)).not.toThrow();
    });

    it('renders a canvas element for the map', () => {
      const { container } = render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('paint mode toggle', () => {
    it('has a paint mode toggle button', () => {
      render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      expect(screen.getByRole('button', { name: /paint|tracking mode|activate/i })).toBeInTheDocument();
    });

    it('paint mode toggle changes aria-pressed state', () => {
      render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      const btn = screen.getByRole('button', { name: /paint|tracking mode|activate/i });
      fireEvent.click(btn);
      expect(btn.getAttribute('aria-pressed')).toBe('true');
    });
  });

  describe('cell state', () => {
    it('shows count of activated cells', () => {
      render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      expect(screen.getByText(/1.*cell|cell.*1/i)).toBeInTheDocument();
    });

    it('has a Clear All button', () => {
      render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      expect(screen.getByRole('button', { name: /clear all|reset/i })).toBeInTheDocument();
    });

    it('Clear All calls clearAllCells', async () => {
      const { clearAllCells } = await import('../src/services/session-grid-service');
      render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      fireEvent.click(screen.getByRole('button', { name: /clear all|reset/i }));
      expect(clearAllCells).toHaveBeenCalled();
    });
  });

  describe('session scoping', () => {
    it('passes sessionId to getActivatedCells', async () => {
      const { getActivatedCells } = await import('../src/services/session-grid-service');
      render(<SessionGridTracker sessionId="sess-42" mapId="map-1" database={mockDb as never} cellSize={50} />);
      expect(vi.mocked(getActivatedCells)).toHaveBeenCalledWith(expect.anything(), 'sess-42', expect.anything());
    });
  });

  // #110: handleMapClick is dead code — never wired to canvas
  describe('click wiring (#110)', () => {
    it('source does not contain void handleMapClick', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/SessionGridTracker.tsx', 'utf8');
      expect(src).not.toMatch(/void\s+handleMapClick/);
    });

    it('source wires onClick to the canvas element', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/SessionGridTracker.tsx', 'utf8');
      expect(src).toMatch(/onClick[=:{][^;]{0,80}handleMapClick|handleMapClick[^;]{0,80}onClick/s);
    });

    it('clicking the canvas in paint mode calls activateCell', async () => {
      const { activateCell } = await import('../src/services/session-grid-service');
      vi.mocked(activateCell).mockClear();
      const { container } = render(<SessionGridTracker sessionId="sess-1" mapId="map-1" database={mockDb as never} cellSize={50} />);
      fireEvent.click(screen.getByRole('button', { name: /paint|tracking mode|activate/i }));
      const canvas = container.querySelector('canvas')!;
      fireEvent.click(canvas, { clientX: 75, clientY: 75 });
      expect(activateCell).toHaveBeenCalled();
    });
  });
});
