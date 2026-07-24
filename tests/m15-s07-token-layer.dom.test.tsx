// M15-S07: Token-Layer UI — render (portrait/ring/name/counter/chips), drag,
// editor (rendered UI, no prompt), create. See:
// https://github.com/Djimon/WorldBrain/issues/279
//
// AP-001: DatabaseLike, no unknown casts. AP-003: no prompt/alert/confirm
// (asserted via source scan). AP-008 (RTL): anchored queries.

import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapToken } from '../src/ui/MapTokenLayer';
import { TokenEditor } from '../src/ui/TokenEditor';
import type { MapTokenRow } from '../src/services/map-token-service';

// #300: chip icons resolve through the icon-set registry (set_id:icon_key)
// instead of being rendered as a literal string.
vi.mock('../src/services/icon-set-registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/icon-set-registry')>();
  return {
    ...actual,
    getIcon: vi.fn((ref: string) =>
      ref === 'core:poisoned' ? { key: 'poisoned', glyph: '☠', label: 'Poisoned' } : undefined),
  };
});

function makeToken(overrides: Partial<MapTokenRow> = {}): MapTokenRow {
  return {
    id: 'token_1', layer_id: 'lyr_1', map_id: 'map-1',
    art_asset_id: null, render_style: 'token', art_offset_x: 0, art_offset_y: 0,
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

  it('falls back to a generic name when the token has no label (no entity link)', () => {
    render(<MapToken {...baseProps({ token: makeToken({ label: null }) })} />);
    expect(screen.getByText(/^Token$/)).toBeInTheDocument();
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

describe('#300 chip icons resolve via the icon-set registry', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof MapToken>> = {}) {
    return { token: makeToken(), scale: 1, ...overrides };
  }

  it('renders the resolved glyph for a "set_id:icon_key" chip icon, not the literal ref string', () => {
    render(<MapToken {...baseProps({ token: makeToken({ status_chips: [{ icon: 'core:poisoned', text: 'Poisoned' }] }) })} />);
    const chip = document.querySelector('.map-token__chip') as HTMLElement;
    expect(chip.textContent).toBe('☠');
    expect(chip.textContent).not.toContain('core:poisoned');
  });
});

// #300 (design section "Chip-Rendering am Token"): render_style='token' shows
// chips as an arc above the token; render_style='plain' shows them side by
// side, fixed to the top edge, centered. Chip size scales with the token's
// own `scale` (#301). Overflow (many chips) grows the arc up to a full
// circle instead of truncating.
describe('#300 chip rendering: arc (token) vs row (plain) layout, overflow, scale', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof MapToken>> = {}) {
    return { token: makeToken(), scale: 1, ...overrides };
  }
  function twoChips() {
    return [{ icon: '☠', text: 'Gift' }, { icon: '💤', text: 'Schlaf' }];
  }

  it('render_style="token": chips container carries the arc layout modifier', () => {
    render(<MapToken {...baseProps({ token: makeToken({ render_style: 'token', status_chips: twoChips() }) })} />);
    const chips = document.querySelector('.map-token__chips') as HTMLElement;
    expect(chips.className).toMatch(/\bmap-token__chips--arc\b/);
  });

  it('render_style="plain": chips container carries the row layout modifier, not arc', () => {
    render(<MapToken {...baseProps({ token: makeToken({ render_style: 'plain', status_chips: twoChips() }) })} />);
    const chips = document.querySelector('.map-token__chips') as HTMLElement;
    expect(chips.className).toMatch(/\bmap-token__chips--row\b/);
    expect(chips.className).not.toMatch(/\bmap-token__chips--arc\b/);
  });

  it('render_style="token": each chip is individually rotated (arc), and no two chips share the same angle', () => {
    render(<MapToken {...baseProps({ token: makeToken({ render_style: 'token', status_chips: twoChips() }) })} />);
    const chips = Array.from(document.querySelectorAll('.map-token__chip')) as HTMLElement[];
    expect(chips).toHaveLength(2);
    const transforms = chips.map((c) => c.style.transform);
    for (const t of transforms) expect(t).toMatch(/rotate\(-?\d+(\.\d+)?deg\)/);
    expect(new Set(transforms).size).toBe(transforms.length);
  });

  it('overflow: many chips (12) still render all of them, spread as a full arc instead of being truncated', () => {
    const manyChips = Array.from({ length: 12 }, (_, i) => ({ icon: `chip-${i}` }));
    render(<MapToken {...baseProps({ token: makeToken({ render_style: 'token', status_chips: manyChips }) })} />);
    const chips = Array.from(document.querySelectorAll('.map-token__chip')) as HTMLElement[];
    expect(chips).toHaveLength(12);
    const angles = chips.map((c) => Number(c.style.transform.match(/rotate\((-?\d+(?:\.\d+)?)deg\)/)?.[1]));
    expect(angles.every((a) => Number.isFinite(a))).toBe(true);
    // 12 chips growing "bis zum Vollkreis" must span (close to) a full 360°
    // arc, not be squeezed into the same narrow arc used for 2-3 chips.
    expect(Math.max(...angles) - Math.min(...angles)).toBeGreaterThan(180);
  });

  // Regression (2026-07-24, live report): chips were growing faster than the
  // token itself. Root cause was double-scaling — the token root already has
  // `transform: scale(tokenScale/mapScale)`, which the chips inherit as
  // descendants; multiplying chip fontSize by tokenScale on top of that
  // compounded the growth. A second live report then found that even a
  // *fixed* inline fontSize was wrong — it silently shadowed style.css's
  // font-size rule (inline always wins), so editing the CSS had no visible
  // effect. Chips must not set fontSize inline at all — sizing lives purely
  // in style.css, scaling comes only from the token root's transform.
  it('chip has no inline fontSize (base size lives in style.css, not JS) — same regardless of the token\'s own scale (#301)', () => {
    const chipsSmall = (() => {
      const { unmount } = render(<MapToken {...baseProps({ token: makeToken({ scale: 1, status_chips: twoChips() }) })} />);
      const size = (document.querySelector('.map-token__chip') as HTMLElement).style.fontSize;
      unmount();
      return size;
    })();
    const chipsLarge = (() => {
      render(<MapToken {...baseProps({ token: makeToken({ scale: 2, status_chips: twoChips() }) })} />);
      return (document.querySelector('.map-token__chip') as HTMLElement).style.fontSize;
    })();
    expect(chipsSmall).toBe('');
    expect(chipsLarge).toBe(chipsSmall);
  });
});

// #300: TokenEditor's chip icon field must be wired to the IconPicker
// (grid popover, registry-backed) instead of a plain-text input for the icon.
describe('#300 TokenEditor: chip icon field uses IconPicker, not free text', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof TokenEditor>> = {}) {
    return {
      token: makeToken({ status_chips: [{ icon: 'core:poisoned', text: 'Poisoned' }] }),
      onPickArt: vi.fn(async () => null),
      resolveAssetUrl: (a: string) => `/assets/${a}`,
      onSave: vi.fn(),
      onDelete: vi.fn(),
      onClose: vi.fn(),
      ...overrides,
    };
  }

  it('the chip row no longer has a free-text input for the icon (aria-label "Chip-Symbol")', () => {
    render(<TokenEditor {...baseProps()} />);
    expect(screen.queryByLabelText(/^chip-symbol$/i)).not.toBeInTheDocument();
  });

  it('each chip row shows an icon-picker trigger button with the resolved glyph, not the raw ref string', () => {
    render(<TokenEditor {...baseProps()} />);
    const row = document.querySelector('.token-editor__chip-row') as HTMLElement;
    const trigger = within(row).getByRole('button', { name: /symbol|icon/i });
    expect(trigger.textContent).not.toContain('core:poisoned');
  });

  it('clicking the icon-picker trigger opens the IconPicker grid popover', () => {
    render(<TokenEditor {...baseProps()} />);
    const row = document.querySelector('.token-editor__chip-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /symbol|icon/i }));
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('selecting an icon in the popover updates the chip and closes the picker', () => {
    render(<TokenEditor {...baseProps()} />);
    const row = document.querySelector('.token-editor__chip-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /symbol|icon/i }));
    fireEvent.click(screen.getByRole('button', { name: /^asleep$/i }));
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('AP-008: two chip rows each get an independently scoped icon-picker trigger (no cross-row collision)', () => {
    render(<TokenEditor {...baseProps({
      token: makeToken({ status_chips: [{ icon: 'core:poisoned' }, { icon: 'core:asleep' }] }),
    })} />);
    const rows = document.querySelectorAll('.token-editor__chip-row');
    expect(rows).toHaveLength(2);
    for (const row of Array.from(rows)) {
      expect(within(row as HTMLElement).getByRole('button', { name: /symbol|icon/i })).toBeInTheDocument();
    }
  });

  it('saving persists the icon chosen via the picker as a "set_id:icon_key" ref', () => {
    const onSave = vi.fn();
    render(<TokenEditor {...baseProps({
      token: makeToken({ status_chips: [{ icon: '' }] }),
      onSave,
    })} />);
    const row = document.querySelector('.token-editor__chip-row') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: /symbol|icon/i }));
    fireEvent.click(screen.getByRole('button', { name: /^bleeding$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^speichern$/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ status_chips: [expect.objectContaining({ icon: 'core:bleeding' })] }),
    );
  });
});

describe('#303 counter badge + stepper: positioning, visibility, ±1, no clamp', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof MapToken>> = {}) {
    return { token: makeToken({ counter_label: 'HP', counter_value: 10 }), scale: 1, ...overrides };
  }

  describe('no counter set => no badge and no stepper', () => {
    it('renders neither badge nor stepper when counter_value is null', () => {
      render(<MapToken {...baseProps({ token: makeToken({ counter_value: null }) })} />);
      expect(document.querySelector('.map-token__counter')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^erhöhen$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^verringern$/i })).not.toBeInTheDocument();
    });
  });

  describe('stepper visibility: hidden by default, shown on hover or selection (D-B)', () => {
    it('the stepper is not in the rendered output without hover or selection', () => {
      render(<MapToken {...baseProps()} />);
      expect(screen.queryByRole('button', { name: /^erhöhen$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^verringern$/i })).not.toBeInTheDocument();
    });

    it('hovering the counter reveals the stepper', () => {
      render(<MapToken {...baseProps()} />);
      fireEvent.mouseEnter(document.querySelector('.map-token__counter') as HTMLElement);
      expect(screen.getByRole('button', { name: /^erhöhen$/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^verringern$/i })).toBeInTheDocument();
    });

    it('a selected token shows the stepper without hover', () => {
      render(<MapToken {...baseProps({ selected: true })} />);
      expect(screen.getByRole('button', { name: /^erhöhen$/i })).toBeInTheDocument();
    });
  });

  describe('positioning: chips (top arc) and counter badge (bottom-right) never share an anchor', () => {
    it.each(['token', 'plain'] as const)('render_style=%s: chips and counter badge use different position classes', (renderStyle) => {
      render(<MapToken {...baseProps({ token: makeToken({ render_style: renderStyle, status_chips: [{ icon: '☠' }, { icon: '💤' }], counter_value: 5 }) })} />);
      const chips = document.querySelector('.map-token__chips') as HTMLElement;
      const badge = document.querySelector('.map-token__counter') as HTMLElement;
      expect(chips).toBeInTheDocument();
      expect(badge).toBeInTheDocument();
      expect(chips.className).not.toBe(badge.className);
    });
  });

  describe('counter_label appears in tooltip and, on hover/selection, next to the badge', () => {
    it('the badge has a title (tooltip) with the counter_label', () => {
      render(<MapToken {...baseProps()} />);
      const badge = document.querySelector('.map-token__counter') as HTMLElement;
      expect(badge.title).toBe('HP');
    });

    it('hovering the counter shows the counter_label as visible text next to the badge', () => {
      render(<MapToken {...baseProps()} />);
      fireEvent.mouseEnter(document.querySelector('.map-token__counter') as HTMLElement);
      expect(screen.getByText(/^HP$/)).toBeInTheDocument();
    });
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

  // #303: up/down stepper persists via setCounter, without opening the TokenEditor.
  it('clicking the up-stepper (on hover) calls setCounter with value+1', async () => {
    const { listTokens, setCounter } = await import('../src/services/map-token-service');
    (listTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce([makeToken({ id: 'token_1', counter_label: 'HP', counter_value: 10 })]);
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const tok = await waitFor(() => {
      const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement | null;
      if (!el) throw new Error('token not rendered');
      return el;
    });
    fireEvent.mouseEnter(tok.querySelector('.map-token__counter') as HTMLElement);
    fireEvent.click(within(tok).getByRole('button', { name: /^erhöhen$/i }));
    await waitFor(() => expect(setCounter).toHaveBeenCalledWith(mockDb, 'token_1', { counter_value: 11 }));
  });

  it('clicking the down-stepper allows going negative (no clamp)', async () => {
    const { listTokens, setCounter } = await import('../src/services/map-token-service');
    (listTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce([makeToken({ id: 'token_1', counter_label: 'HP', counter_value: 0 })]);
    render(<MapViewer mapId="map-1" database={mockDb as never} />);
    const tok = await waitFor(() => {
      const el = document.querySelector('[data-token-id="token_1"]') as HTMLElement | null;
      if (!el) throw new Error('token not rendered');
      return el;
    });
    fireEvent.mouseEnter(tok.querySelector('.map-token__counter') as HTMLElement);
    fireEvent.click(within(tok).getByRole('button', { name: /^verringern$/i }));
    await waitFor(() => expect(setCounter).toHaveBeenCalledWith(mockDb, 'token_1', { counter_value: -1 }));
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
    expect(screen.getByLabelText(/rahmenfarbe/i)).toBeInTheDocument();
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
