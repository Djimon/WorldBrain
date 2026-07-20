// M15-S02: Layer-Panel UI — Stack, Opacity, Show/Hide, z-Order, Player-Visible
// See: https://github.com/Djimon/WorldBrain/issues/274
//
// Rows have no name/type label (removed 2026-07-20) — they are addressed by
// data-layer-id. Rows default to COLLAPSED; controls live behind the "Details"
// toggle, so control tests expand the row first.
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan; delete
// uses a rendered inline confirm row instead.
// AP-008 (RTL): within(row) scoping so per-row controls cannot collide.

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

function renderPanel() {
  const view = render(<LayerPanel database={mockDb} mapId="map-1" />);
  return view;
}

async function getRow(container: HTMLElement, layerId: string): Promise<HTMLElement> {
  return waitFor(() => {
    const el = container.querySelector(`[data-layer-id="${layerId}"]`);
    if (!el) throw new Error(`row ${layerId} not rendered`);
    return el as HTMLElement;
  });
}

// Rows default collapsed — expand to reach the controls.
function expandRow(row: HTMLElement) {
  fireEvent.click(within(row).getByRole('button', { name: /^details$/i }));
}

describe('M15-S02 layer panel', () => {
  it('renders one row per layer, ordered by z_order descending (top first)', async () => {
    const { container } = renderPanel();
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
    const ids = Array.from(container.querySelectorAll('[data-layer-id]')).map((el) => el.getAttribute('data-layer-id'));
    expect(ids).toEqual(['layer_top', 'layer_mid', 'layer_bottom']);
  });

  it('changing the opacity slider for a row calls updateLayer with a 0-1 opacity', async () => {
    const { updateLayer } = await import('../src/services/map-layer-service');
    const { container } = renderPanel();
    const row = await getRow(container, 'layer_mid');
    expandRow(row);
    fireEvent.change(within(row).getByRole('slider', { name: /^deckkraft$/i }), { target: { value: '50' } });
    await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_mid', expect.objectContaining({ opacity: 0.5 })));
  });

  it('toggling visible off calls updateLayer(visible:false)', async () => {
    const { updateLayer } = await import('../src/services/map-layer-service');
    const { container } = renderPanel();
    const row = await getRow(container, 'layer_mid');
    expandRow(row);
    fireEvent.click(within(row).getByRole('button', { name: /^ausblenden$/i }));
    await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_mid', expect.objectContaining({ visible: false })));
  });

  it('a player-visible toggle exists per row and calls updateLayer(player_visible:...)', async () => {
    const { updateLayer } = await import('../src/services/map-layer-service');
    const { container } = renderPanel();
    const row = await getRow(container, 'layer_top');
    expandRow(row);
    fireEvent.click(within(row).getByRole('button', { name: /^spielersichtbar$/i }));
    await waitFor(() => expect(updateLayer).toHaveBeenCalledWith(mockDb, 'layer_top', expect.objectContaining({ player_visible: true })));
  });

  it('moving a layer up calls reorderLayers with the new z_order-descending id list', async () => {
    const { reorderLayers } = await import('../src/services/map-layer-service');
    const { container } = renderPanel();
    const row = await getRow(container, 'layer_mid');
    expandRow(row);
    fireEvent.click(within(row).getByRole('button', { name: /^nach oben$/i }));
    await waitFor(() =>
      expect(reorderLayers).toHaveBeenCalledWith(mockDb, 'map-1', ['layer_mid', 'layer_top', 'layer_bottom']),
    );
  });

  it('delete shows an inline confirm row before calling deleteLayer', async () => {
    const { deleteLayer } = await import('../src/services/map-layer-service');
    const { container } = renderPanel();
    const row = await getRow(container, 'layer_mid');
    expandRow(row);
    fireEvent.click(within(row).getByRole('button', { name: /^löschen$/i }));
    expect(deleteLayer).not.toHaveBeenCalled();
    fireEvent.click(await within(row).findByRole('button', { name: /^ja, löschen$/i }));
    await waitFor(() => expect(deleteLayer).toHaveBeenCalledWith(mockDb, 'layer_mid'));
  });

  it('"Bild-Layer hinzufügen" calls onAddImageLayer', async () => {
    const onAddImageLayer = vi.fn();
    render(<LayerPanel database={mockDb} mapId="map-1" onAddImageLayer={onAddImageLayer} />);
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
    fireEvent.click(screen.getByRole('button', { name: /^\+ map layer$/i }));
    expect(onAddImageLayer).toHaveBeenCalled();
  });

  it('"Fog-Layer hinzufügen" calls onAddFogLayer', async () => {
    const onAddFogLayer = vi.fn();
    render(<LayerPanel database={mockDb} mapId="map-1" onAddFogLayer={onAddFogLayer} />);
    await waitFor(() => expect(screen.getAllByRole('listitem').length).toBe(3));
    fireEvent.click(screen.getByRole('button', { name: /^\+ fog layer$/i }));
    expect(onAddFogLayer).toHaveBeenCalled();
  });

  it('LayerPanel.tsx does not call prompt/alert/confirm (AP-003)', () => {
    const src = readFileSync('src/ui/LayerPanel.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
});
