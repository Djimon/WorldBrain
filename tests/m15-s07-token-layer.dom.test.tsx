// M15-S07: Token-Layer UI — render (portrait/ring/name/counter/chips), drag,
// editor (rendered UI, no prompt), create. See:
// https://github.com/Djimon/WorldBrain/issues/279
//
// AP-001: DatabaseLike, no unknown casts. AP-003: no prompt/alert/confirm
// (asserted via source scan). AP-008 (RTL): anchored queries.

import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapToken } from '../src/ui/MapTokenLayer';
import type { MapTokenRow } from '../src/services/map-token-service';

function makeToken(overrides: Partial<MapTokenRow> = {}): MapTokenRow {
  return {
    id: 'token_1', layer_id: 'lyr_1', map_id: 'map-1', entity_id: null,
    label: 'Grünhaut', x: 100, y: 120, ring_color: '#ff0000',
    counter_label: null, counter_value: null, status_chips: [],
    session_id: null, created_at: '',
    ...overrides,
  };
}

describe('M15-S07 (component): MapToken render', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof MapToken>> = {}) {
    return { token: makeToken(), scale: 1, ...overrides };
  }

  it('renders a circular portrait, a colored ring and a name pill', () => {
    render(<MapToken {...baseProps()} />);
    const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement;
    expect(el).toBeInTheDocument();
    expect(el.querySelector('.map-token__portrait')).toBeInTheDocument();
    expect(el.querySelector('.map-token__ring')).toBeInTheDocument();
    expect(screen.getByText(/^Grünhaut$/)).toBeInTheDocument();
  });

  it('uses the linked entity title as name when the token has no label', () => {
    render(<MapToken {...baseProps({ token: makeToken({ label: null }), entityTitle: 'Goblin-König' })} />);
    expect(screen.getByText(/^Goblin-König$/)).toBeInTheDocument();
  });

  it('renders a counter badge only when counter_value is set', () => {
    const { rerender } = render(<MapToken {...baseProps()} />);
    expect(document.querySelector('.map-token__counter')).not.toBeInTheDocument();
    rerender(<MapToken {...baseProps({ token: makeToken({ counter_label: 'HP', counter_value: 12 }) })} />);
    const badge = document.querySelector('.map-token__counter') as HTMLElement;
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toContain('12');
  });

  it('renders one status chip per chip in an arc', () => {
    render(<MapToken {...baseProps({ token: makeToken({ status_chips: [
      { icon: '☠', color: 'green', text: 'Gift' },
      { icon: '💤', text: 'Schlaf' },
    ] }) })} />);
    expect(document.querySelectorAll('.map-token__chips .map-token__chip')).toHaveLength(2);
  });

  it('scales inversely with map zoom (scale(1/scale))', () => {
    render(<MapToken {...baseProps({ scale: 2 })} />);
    const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement;
    expect(el.style.transform).toContain('scale(0.5)');
  });
});

// --- MapViewer integration: drag, create, editor -----------------------------

const LAYERS = [
  { id: 'img1', map_id: 'map-1', layer_type: 'image', name: 'Base', asset_id: 'base.png', mask_data: null, opacity: 1, z_order: 0, visible: 1, player_visible: 1, offset_x: 0, offset_y: 0, created_at: '' },
];
const TOKENS: MapTokenRow[] = [makeToken({ id: 'token_1', label: 'Ork', x: 50, y: 60 })];

vi.mock('../src/services/map-layer-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-layer-service')>();
  return { ...actual, listLayers: vi.fn(async () => LAYERS), updateLayer: vi.fn(async () => {}) };
});
vi.mock('../src/services/map-token-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/map-token-service')>();
  return {
    ...actual,
    listTokens: vi.fn(async () => TOKENS),
    createToken: vi.fn(async () => ({ id: 'token_new' })),
    moveToken: vi.fn(async () => {}),
    updateToken: vi.fn(async () => {}),
    setCounter: vi.fn(async () => {}),
    setStatusChips: vi.fn(async () => {}),
    deleteToken: vi.fn(async () => {}),
  };
});
vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(async () => ({ id: 'map-1', title: 'Test', image_width_px: 1000, image_height_px: 800, calibration_json: null })),
  listMaps: vi.fn(async () => []),
  importMapImage: vi.fn(async () => ({ id: 'map-1' })),
  createMap: vi.fn(async () => ({ id: 'map-1' })),
  loadGridSettings: vi.fn(async () => null),
  saveGridSettings: vi.fn(async () => undefined),
  getAssetUrl: vi.fn((a: string) => `/assets/${a}`),
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

import { MapViewer } from '../src/ui/MapViewer';
import { moveToken, createToken } from '../src/services/map-token-service';

const mockDb = { execute: vi.fn(), select: vi.fn() };

describe('M15-S07 (integration): tokens in MapViewer', () => {
  it('renders tokens from listTokens on the map', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(document.querySelector('[data-token-id="token_1"]')).toBeInTheDocument());
  });

  it('dragging a token persists via moveToken', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const tok = await waitFor(() => {
      const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement | null;
      if (!el) throw new Error('token not rendered');
      return el;
    });
    fireEvent.pointerDown(tok, { clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(tok, { clientX: 200, clientY: 240, pointerId: 1 });
    fireEvent.pointerUp(tok, { clientX: 200, clientY: 240, pointerId: 1 });
    await waitFor(() => expect(moveToken).toHaveBeenCalledWith(mockDb, 'token_1', expect.any(Number), expect.any(Number)));
  });

  it('clicking a token opens a rendered editor (not a prompt)', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const tok = await waitFor(() => {
      const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement | null;
      if (!el) throw new Error('token not rendered');
      return el;
    });
    fireEvent.click(tok);
    expect(await screen.findByRole('dialog', { name: /^token bearbeiten$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/ringfarbe/i)).toBeInTheDocument();
  });

  it('the Token tool + a map click creates a token via createToken', async () => {
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    await waitFor(() => expect(document.querySelector('[data-token-id="token_1"]')).toBeInTheDocument());
    fireEvent.click(screen.getByTitle(/^token setzen$/i));
    const canvas = document.querySelector('[data-map-canvas]') as HTMLElement;
    fireEvent.click(canvas, { clientX: 300, clientY: 300 });
    await waitFor(() => expect(createToken).toHaveBeenCalledWith(mockDb, expect.objectContaining({ map_id: 'map-1' })));
  });
});

describe('no prompt()/alert()/confirm() (AP-003)', () => {
  it('MapTokenLayer.tsx does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/ui/MapTokenLayer.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
  it('TokenEditor.tsx does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/ui/TokenEditor.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
});
