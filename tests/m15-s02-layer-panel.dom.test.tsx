// M15-S02: Layer-Panel UI — Stack, Opacity, Show/Hide, z-Order, Player-Visible
// See: https://github.com/Djimon/WorldBrain/issues/274
//
// Note (reorder): see LayerPanel.tsx's header comment — reorder is tested
// via accessible move-up/move-down buttons, not raw pointer-drag simulation
// (impractical/flaky in jsdom; the AC's actual requirement, reorderLayers
// persisting the new order, is fully exercised this way).
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan; delete
// uses a rendered inline confirm row instead.
// AP-008 (RTL): anchored queries; getAllBy*/within where per-row controls
// could collide across rows.

import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LayerPanel } from '../src/ui/LayerPanel';

const LAYERS = [
  { id: 'layer_top', map_id: 'map-1', layer_type: 'fog', name: 'Fog A', asset_id: null, mask_data: null, opacity: 1, z_order: 2, visible: 1, player_visible: 0, created_at: '' },
  { id: 'layer_mid', map_id: 'map-1', layer_type: 'image', name: 'Overlay', asset_id: 'a.png', mask_data: null, opacity: 0.8, z_order: 1, visible: 1, player_visible: 1, created_at: '' },
  { id: 'layer_bottom', map_id: 'map-1', layer_type: 'image', name: 'Base', asset_id: 'base.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, created_at: '' },
];

vi.mock('../src/services/map-layer-service', () => ({
  listLayers: vi.fn(async () => LAYERS),
  updateLayer: vi.fn(async () => undefined),
  deleteLayer: vi.fn(async () => undefined),
  reorderLayers: vi.fn(async () => undefined),
  createLayer: vi.fn(async () => ({ id: 'layer_new' })),
}));

const mockDb = { execute: vi.fn(), select: vi.fn() };

describe('M15-S02 layer panel', () => {
  describe('one row per layer, ordered by z_order descending (top layer first)', () => {
    it('renders rows in the order Fog A, Overlay, Base', async () => {
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
      const rows = screen.getAllByRole('listitem');
      expect(rows.map((r) => r.textContent)).toEqual([
        expect.stringContaining('Fog A'),
        expect.stringContaining('Overlay'),
        expect.stringContaining('Base'),
      ]);
    });
  });

  describe('opacity slider wired to updateLayer', () => {
    it('changing the opacity slider for a row calls updateLayer with a 0-1 opacity', async () => {
      const { updateLayer } = await import('../src/services/map-layer-service');
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      const row = await screen.findByRole('listitem', { name: /overlay/i });
      const slider = within(row).getByRole('slider', { name: /^deckkraft$/i });
      fireEvent.change(slider, { target: { value: '50' } });
      await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_mid', expect.objectContaining({ opacity: 0.5 })));
    });
  });

  describe('show/hide toggle', () => {
    it('toggling visible off calls updateLayer(visible:false) and shows a hidden indicator', async () => {
      const { updateLayer } = await import('../src/services/map-layer-service');
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      const row = await screen.findByRole('listitem', { name: /overlay/i });
      fireEvent.click(within(row).getByRole('button', { name: /^ausblenden$/i }));
      await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_mid', expect.objectContaining({ visible: false })));
    });
  });

  describe('player-visible toggle', () => {
    it('a player-visible toggle exists per row and calls updateLayer(player_visible:...)', async () => {
      const { updateLayer } = await import('../src/services/map-layer-service');
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      const row = await screen.findByRole('listitem', { name: /fog a/i });
      fireEvent.click(within(row).getByRole('button', { name: /^spielersichtbar$/i }));
      await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_top', expect.objectContaining({ player_visible: true })));
    });
  });

  describe('reorder persists the new order via reorderLayers', () => {
    it('moving "Overlay" up calls reorderLayers with the new z_order-descending id list', async () => {
      const { reorderLayers } = await import('../src/services/map-layer-service');
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      const row = await screen.findByRole('listitem', { name: /overlay/i });
      fireEvent.click(within(row).getByRole('button', { name: /^nach oben$/i }));
      await waitFor(() =>
        expect(reorderLayers).toHaveBeenCalledWith(mockDb, 'map-1', ['layer_mid', 'layer_top', 'layer_bottom']),
      );
    });
  });

  describe('delete uses a rendered inline confirm row, not window.confirm', () => {
    it('clicking delete shows an inline confirm row before calling deleteLayer', async () => {
      const { deleteLayer } = await import('../src/services/map-layer-service');
      render(<LayerPanel database={mockDb} mapId="map-1" />);
      const row = await screen.findByRole('listitem', { name: /overlay/i });
      fireEvent.click(within(row).getByRole('button', { name: /^löschen$/i }));
      expect(deleteLayer).not.toHaveBeenCalled();
      const confirmBtn = await within(row).findByRole('button', { name: /^ja, löschen$/i });
      fireEvent.click(confirmBtn);
      await waitFor(() => expect(deleteLayer).toHaveBeenCalledWith(mockDb, 'layer_mid'));
    });
  });

  describe('add-layer entry points', () => {
    it('"Bild-Layer hinzufügen" calls onAddImageLayer', async () => {
      const onAddImageLayer = vi.fn();
      render(<LayerPanel database={mockDb} mapId="map-1" onAddImageLayer={onAddImageLayer} />);
      await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
      fireEvent.click(screen.getByRole('button', { name: /^bild-layer hinzufügen$/i }));
      expect(onAddImageLayer).toHaveBeenCalled();
    });

    it('"Fog-Layer hinzufügen" calls onAddFogLayer', async () => {
      const onAddFogLayer = vi.fn();
      render(<LayerPanel database={mockDb} mapId="map-1" onAddFogLayer={onAddFogLayer} />);
      await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
      fireEvent.click(screen.getByRole('button', { name: /^fog-layer hinzufügen$/i }));
      expect(onAddFogLayer).toHaveBeenCalled();
    });
  });

  describe('no prompt()/alert()/confirm() (AP-003)', () => {
    it('LayerPanel.tsx does not call prompt/alert/confirm', () => {
      const src = readFileSync('src/ui/LayerPanel.tsx', 'utf-8');
      expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
    });
  });
});
