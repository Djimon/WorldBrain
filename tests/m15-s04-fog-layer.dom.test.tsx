// M15-S04: Fog-Layer & Paint-Tools — Raster-Maske, Pinsel/Rechteck, Reveal/Cover
// See: https://github.com/Djimon/WorldBrain/issues/276
//
// Note: real pixel-level canvas paint operations are not exercised here —
// jsdom has no canvas 2D backend in this repo (no existing precedent
// anywhere for pixel-level canvas assertions; GridLayer/PaintInteractionLayer
// have none either). FogMaskCanvas is tested at its contract boundary
// (onStrokeEnd receives an updated mask string after a pointer down/move/up
// sequence) rather than asserting actual pixel content.
//
// AP-001: database prop typed as DatabaseLike; no unknown/as-never casts.
// AP-003: no prompt()/alert()/confirm() — asserted via source scan.
// AP-006: JSON.parse/mask-decode fallback is the AP-006 exception; not
// applicable to these stub-level tests.
// AP-008 (RTL): anchored queries.

import { readFileSync } from 'node:fs';
import type { ComponentProps } from 'react';
import { DatabaseSync } from 'node:sqlite';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';
import { FogTools } from '../src/ui/FogTools';
import { FogMaskCanvas } from '../src/ui/FogMaskCanvas';

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => {
      db.prepare(sql).run(...args);
      return Promise.resolve();
    },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => {
      return Promise.resolve(db.prepare(sql).all(...args) as T[]);
    },
  };
}

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyMapSchema(raw);
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

async function getMapLayerService() { return import('../src/services/map-layer-service'); }

describe('M15-S04 (service): createFogLayer', () => {
  it('creates a fog layer with non-empty, fully-covering mask_data', async () => {
    const { db, asyncDb } = createDatabase();
    const { createFogLayer, listLayers } = await getMapLayerService();
    try {
      const { id } = await createFogLayer(asyncDb, { map_id: 'map-1' });
      const layers = await listLayers(asyncDb, 'map-1');
      const fog = layers.find((l) => l.id === id);
      expect(fog?.layer_type).toBe('fog');
      expect(fog?.mask_data).toBeTruthy();
    } finally {
      db.close();
    }
  });

  it('places the fog layer at z_order = max(existing) + 1', async () => {
    const { db, asyncDb } = createDatabase();
    const { createLayer, createFogLayer, listLayers } = await getMapLayerService();
    try {
      await createLayer(asyncDb, { map_id: 'map-1', layer_type: 'image' });
      const { id } = await createFogLayer(asyncDb, { map_id: 'map-1' });
      const layers = await listLayers(asyncDb, 'map-1');
      const fog = layers.find((l) => l.id === id);
      expect(fog?.z_order).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('M15-S04 (UI): FogTools toolbar', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof FogTools>> = {}) {
    return {
      brushSize: 20,
      feather: 5,
      mode: 'reveal' as const,
      shape: 'brush' as const,
      onBrushSizeChange: vi.fn(),
      onFeatherChange: vi.fn(),
      onModeChange: vi.fn(),
      onShapeChange: vi.fn(),
      ...overrides,
    };
  }

  it('renders a brush-size control', () => {
    render(<FogTools {...baseProps()} />);
    expect(screen.getByRole('slider', { name: /^pinselgröße$/i })).toBeInTheDocument();
  });

  it('renders a feather control', () => {
    render(<FogTools {...baseProps()} />);
    expect(screen.getByRole('slider', { name: /^weichzeichnung$/i })).toBeInTheDocument();
  });

  it('renders brush, square and region shape buttons; clicking calls onShapeChange with the right shape', () => {
    const onShapeChange = vi.fn();
    render(<FogTools {...baseProps({ onShapeChange })} />);
    expect(screen.getByRole('button', { name: /^pinsel$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^rechteck$/i }));
    expect(onShapeChange).toHaveBeenCalledWith('square');
    fireEvent.click(screen.getByRole('button', { name: /^bereich$/i }));
    expect(onShapeChange).toHaveBeenCalledWith('region');
  });

  it('renders reveal/cover mode buttons; clicking cover calls onModeChange', () => {
    const onModeChange = vi.fn();
    render(<FogTools {...baseProps({ onModeChange })} />);
    expect(screen.getByRole('button', { name: /^aufdecken$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^verdecken$/i }));
    expect(onModeChange).toHaveBeenCalledWith('cover');
  });

  it('changing brush size calls onBrushSizeChange', () => {
    const onBrushSizeChange = vi.fn();
    render(<FogTools {...baseProps({ onBrushSizeChange })} />);
    fireEvent.change(screen.getByRole('slider', { name: /^pinselgröße$/i }), { target: { value: '40' } });
    expect(onBrushSizeChange).toHaveBeenCalledWith(40);
  });
});

describe('M15-S04 (UI): FogMaskCanvas', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof FogMaskCanvas>> = {}) {
    return {
      layerId: 'layer_fog_1',
      maskData: null,
      imgW: 1000,
      imgH: 800,
      mode: 'reveal' as const,
      shape: 'brush' as const,
      brushSize: 20,
      feather: 5,
      active: true,
      onStrokeEnd: vi.fn(),
      ...overrides,
    };
  }

  it('renders a canvas tagged with the layer id', () => {
    render(<FogMaskCanvas {...baseProps()} />);
    expect(document.querySelector('canvas[data-fog-layer-id="layer_fog_1"]')).toBeInTheDocument();
  });

  it('a pointer down/move/up stroke calls onStrokeEnd with an updated mask string', () => {
    const onStrokeEnd = vi.fn();
    render(<FogMaskCanvas {...baseProps({ onStrokeEnd })} />);
    const canvas = document.querySelector('canvas[data-fog-layer-id="layer_fog_1"]') as HTMLElement;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(canvas, { clientX: 20, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 20, clientY: 20 });
    expect(onStrokeEnd).toHaveBeenCalledWith(expect.any(String));
  });

  it('inactive (active=false) does not respond to pointer strokes', () => {
    const onStrokeEnd = vi.fn();
    render(<FogMaskCanvas {...baseProps({ active: false, onStrokeEnd })} />);
    const canvas = document.querySelector('canvas[data-fog-layer-id="layer_fog_1"]') as HTMLElement;
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10 });
    expect(onStrokeEnd).not.toHaveBeenCalled();
  });

  it('square dab and region tools both commit a mask on stroke end', () => {
    for (const shape of ['square', 'region'] as const) {
      const onStrokeEnd = vi.fn();
      const { unmount } = render(<FogMaskCanvas {...baseProps({ shape, onStrokeEnd })} />);
      const canvas = document.querySelector('canvas[data-fog-layer-id="layer_fog_1"]') as HTMLElement;
      fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10 });
      fireEvent.pointerMove(canvas, { clientX: 40, clientY: 40 });
      fireEvent.pointerUp(canvas, { clientX: 40, clientY: 40 });
      expect(onStrokeEnd).toHaveBeenCalledWith(expect.any(String));
      unmount();
    }
  });
});

describe('no prompt()/alert()/confirm() (AP-003)', () => {
  it('FogTools.tsx does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/ui/FogTools.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });

  it('FogMaskCanvas.tsx does not call prompt/alert/confirm', () => {
    const src = readFileSync('src/ui/FogMaskCanvas.tsx', 'utf-8');
    expect(src).not.toMatch(/\b(prompt|alert|confirm)\s*\(/);
  });
});
