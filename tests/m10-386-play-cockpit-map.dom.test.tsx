// @vitest-environment jsdom
// M10-#386: Integrationstest — Play-Cockpit-Map end-to-end.
// (a) Player-Sicht rendert DB-los aus dem Store; eine Token-Bewegung des Hosts
//     erscheint über den Loopback-Transport auf der Player-Karte.
// (b) DM-Picker präsentiert eine Karte (persistiert via presented-map-service).
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLoopbackTransport } from '../src/services/loopback-transport';
import { createPlayClientStore } from '../src/services/play-client-store';
import { attachClientStoreToTransport } from '../src/services/client-store-transport-bridge';
import { broadcastMovement } from '../src/services/token-movement-service';
import type { Snapshot } from '../src/services/play-sync-protocol';

// MapViewer ist DB-schwer — im DM-Picker-Test durch einen Marker ersetzen.
vi.mock('../src/ui/MapViewer', () => ({
  MapViewer: (props: { mapId: string }) => <div data-testid="mapviewer" data-map={props.mapId} />,
}));

const listMapsMock = vi.fn(async () => [
  { id: 'm1', title: 'Taverne', image_width_px: 100, image_height_px: 100, calibration_json: null, folder_id: null },
  { id: 'm2', title: 'Wald', image_width_px: 100, image_height_px: 100, calibration_json: null, folder_id: null },
]);
vi.mock('../src/services/map-service', () => ({ listMaps: () => listMapsMock() }));

const getPresentedMapIdMock = vi.fn(async () => null as string | null);
const setPresentedMapIdMock = vi.fn(async () => {});
vi.mock('../src/services/presented-map-service', () => ({
  getPresentedMapId: () => getPresentedMapIdMock(),
  setPresentedMapId: (_db: unknown, p: { mapId: string | null }) => setPresentedMapIdMock(p),
}));

import { PlayCockpitMap } from '../src/ui/PlayCockpitMap';

const database = { select: vi.fn(async () => []), execute: vi.fn(async () => {}) } as unknown as Parameters<typeof PlayCockpitMap>[0]['database'];

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('M10-#386 Player map — live token via loopback', () => {
  it("shows the presented map and a host token move over the transport", async () => {
    const { clientSide, hostSide } = createLoopbackTransport();
    const store = createPlayClientStore({ playerId: 'p-1' });
    attachClientStoreToTransport(clientSide, store);

    // Host präsentiert eine Karte + einen Token (Snapshot).
    const snapshot: Snapshot = {
      type: 'snapshot', campaignId: 'c1', recipientPlayerId: 'p-1', serverTime: '2026-01-01T00:00:00Z',
      entities: [
        { kind: 'map', id: 'm1', data: { image_url: 'blob:map' } },
        { kind: 'token', id: 'tok-1', data: { x: 10, y: 10 } },
      ],
    };
    void hostSide.send({ type: 'snapshot', token: 'system-dm', payload: snapshot as unknown as Record<string, unknown> });
    await new Promise<void>((r) => setTimeout(r, 0));

    render(<PlayCockpitMap role="player" campaignId="c1" store={store} />);

    // Token initial bei (10,10).
    await waitFor(() => {
      const el = document.querySelector('[data-token-id="tok-1"]');
      expect(el).not.toBeNull();
      expect(el?.getAttribute('data-x')).toBe('10');
    });

    // Host broadcastet eine Bewegung → Player-Karte folgt.
    broadcastMovement({ campaignId: 'c1', tokenId: 'tok-1', x: 80, y: 90 }, hostSide);
    await waitFor(() => {
      const el = document.querySelector('[data-token-id="tok-1"]');
      expect(el?.getAttribute('data-x')).toBe('80');
      expect(el?.getAttribute('data-y')).toBe('90');
    });
  });
});

describe('M10-#386 DM map picker', () => {
  it('lists project maps and presents one (persisted)', async () => {
    render(<PlayCockpitMap role="dm" campaignId="c1" database={database} />);

    // Beide Karten als Picker-Buttons.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Taverne' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Wald' })).toBeInTheDocument();

    // Präsentieren → setPresentedMapId + MapViewer erscheint.
    fireEvent.click(screen.getByRole('button', { name: 'Wald' }));
    await waitFor(() => {
      expect(setPresentedMapIdMock).toHaveBeenCalledWith({ campaignId: 'c1', mapId: 'm2' });
      expect(screen.getByTestId('mapviewer')).toHaveAttribute('data-map', 'm2');
    });
  });
});
