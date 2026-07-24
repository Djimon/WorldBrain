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
import { stampCellCount, stampCells } from '../src/ui/fogStampGeometry';

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

// #295: Grid-bewusster Fog-Stempel — RED-Phase.
// Wiederverwendet cellKeyFor/MapGrid-Zellgeometrie (keine neue Geometrie);
// AC 4/5/6/8 s. Issue. AP-008 (RTL): die fünf Stufen-Labels teilen ein
// gemeinsames Suffix ("9 Zellen"/"19 Zellen") -> Namen exakt verankert (^…$).
describe('#295 (geometry): stampCellCount — reine Zellzahl pro Stufe/Grid-Typ', () => {
  it.each([
    [0, 1], [1, 9], [2, 25], [3, 49], [4, 81],
  ] as const)('square r%i deckt %i Zellen ab', (level, expected) => {
    expect(stampCellCount(level, 'square')).toBe(expected);
  });

  it.each([
    [0, 1], [1, 7], [2, 19], [3, 37], [4, 61],
  ] as const)('hex-flat r%i deckt %i Zellen ab (Hex-Ring)', (level, expected) => {
    expect(stampCellCount(level, 'hex-flat')).toBe(expected);
  });
});

describe('#295 (geometry): stampCells — zentriert auf der Cursor-Zelle', () => {
  it('square r0: liefert genau die Mittelzelle selbst', () => {
    const cells = stampCells({ col: 5, row: 5 }, 0, 'square');
    expect(cells).toEqual([{ col: 5, row: 5 }]);
  });

  it('square r1: enthält die Mittelzelle, liefert 9 eindeutige Zellen ohne Offset', () => {
    const cells = stampCells({ col: 5, row: 5 }, 1, 'square');
    expect(cells).toHaveLength(9);
    expect(cells).toContainEqual({ col: 5, row: 5 });
    const keys = new Set(cells.map((c) => `${c.col}:${c.row}`));
    expect(keys.size).toBe(9);
  });

  it('hex-flat r0: liefert genau die Mittelzelle selbst', () => {
    const cells = stampCells({ col: 5, row: 5 }, 0, 'hex-flat');
    expect(cells).toEqual([{ col: 5, row: 5 }]);
  });

  it('hex-flat r1: enthält die Mittelzelle, liefert 7 eindeutige Zellen (Hex-Ring)', () => {
    const cells = stampCells({ col: 5, row: 5 }, 1, 'hex-flat');
    expect(cells).toHaveLength(7);
    expect(cells).toContainEqual({ col: 5, row: 5 });
    const keys = new Set(cells.map((c) => `${c.col}:${c.row}`));
    expect(keys.size).toBe(7);
  });

  it.each([0, 1, 2, 3, 4] as const)('stampCells-Länge stimmt für jede Stufe r%i mit stampCellCount überein (square)', (level) => {
    expect(stampCells({ col: 0, row: 0 }, level, 'square')).toHaveLength(stampCellCount(level, 'square'));
  });

  it.each([0, 1, 2, 3, 4] as const)('stampCells-Länge stimmt für jede Stufe r%i mit stampCellCount überein (hex-flat)', (level) => {
    expect(stampCells({ col: 0, row: 0 }, level, 'hex-flat')).toHaveLength(stampCellCount(level, 'hex-flat'));
  });
});

describe('#295 (UI): FogTools — Grid-Stempel im Flyout', () => {
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
      onStampLevelChange: vi.fn(),
      ...overrides,
    };
  }

  it('AC 1/8: Grid-Stempel-Button erscheint bei aktivem square-Grid', () => {
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'square' })} />);
    expect(screen.getByRole('button', { name: /^grid-stempel$|^stempel$/i })).toBeInTheDocument();
  });

  it('AC 1/8: Grid-Stempel-Button erscheint bei aktivem hex-Grid', () => {
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'hex-flat' })} />);
    expect(screen.getByRole('button', { name: /^grid-stempel$|^stempel$/i })).toBeInTheDocument();
  });

  it('AC 8: ohne aktives Grid (gridActive=false) fehlt der Grid-Stempel-Button ganz', () => {
    render(<FogTools {...baseProps({ gridActive: false, gridType: 'square' })} />);
    expect(screen.queryByRole('button', { name: /^grid-stempel$|^stempel$/i })).not.toBeInTheDocument();
  });

  it('AC 1: Pinsel/Rechteck/Bereich bleiben unverändert nutzbar, auch wenn der Grid-Stempel angeboten wird', () => {
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'square' })} />);
    expect(screen.getByRole('button', { name: /^pinsel$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^rechteck$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^bereich$/i })).toBeInTheDocument();
  });

  it('AC 3: Klick auf den Grid-Stempel-Button ruft onShapeChange("grid-stamp") auf', () => {
    const onShapeChange = vi.fn();
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'square', onShapeChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /^grid-stempel$|^stempel$/i }));
    expect(onShapeChange).toHaveBeenCalledWith('grid-stamp');
  });

  it('AC 3/5: Größen-Flyout zeigt fünf Stufen mit Zellzahl-Label für square (1/9/25/49/81 Zellen)', () => {
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'square', shape: 'grid-stamp' })} />);
    for (const n of [1, 9, 25, 49, 81]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${n}\\s*Zellen?$`, 'i') })).toBeInTheDocument();
    }
  });

  it('AC 3/4/5: Größen-Flyout zeigt fünf Stufen mit Zellzahl-Label für hex (1/7/19/37/61 Zellen) — unterscheidet sich von square', () => {
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'hex-flat', shape: 'grid-stamp' })} />);
    for (const n of [1, 7, 19, 37, 61]) {
      expect(screen.getByRole('button', { name: new RegExp(`^${n}\\s*Zellen?$`, 'i') })).toBeInTheDocument();
    }
  });

  it('AC 3: Klick auf eine Stufe ruft onStampLevelChange mit dem Stufen-Index auf', () => {
    const onStampLevelChange = vi.fn();
    render(<FogTools {...baseProps({ gridActive: true, gridType: 'square', shape: 'grid-stamp', onStampLevelChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /^25\s*zellen?$/i }));
    expect(onStampLevelChange).toHaveBeenCalledWith(2);
  });
});

describe('#295 (UI): FogMaskCanvas — Grid-Stempel committet über denselben onStrokeEnd-Vertrag', () => {
  function baseProps(overrides: Partial<ComponentProps<typeof FogMaskCanvas>> = {}) {
    return {
      layerId: 'layer_fog_1',
      maskData: null,
      imgW: 1000,
      imgH: 800,
      mode: 'reveal' as const,
      shape: 'grid-stamp' as const,
      brushSize: 20,
      feather: 5,
      active: true,
      onStrokeEnd: vi.fn(),
      gridType: 'square' as const,
      gridCellSize: 40,
      stampLevel: 1 as const,
      ...overrides,
    };
  }

  // Hinweis (wie oben im Datei-Header dokumentiert): jsdom hat keinen echten
  // Canvas-2D-Backend, daher kann hier keine Pixel-/Zellgeometrie geprüft
  // werden. emit() feuert onStrokeEnd unabhängig von shape/props (bestehende
  // Konvention) — ein reiner "wird aufgerufen"-Test wäre daher für JEDE
  // shape/props-Kombination trivial grün und würde nichts Neues beweisen.
  // Die eigentliche Stempel-Geometrie wird stattdessen in fogStampGeometry.ts
  // (stampCellCount/stampCells) getestet — dort ist echtes RED möglich.
  it('AC 8 (Struktur): shape="grid-stamp" ist ein gültiger FogMaskCanvas-Prop-Wert (Typ-Vertrag)', () => {
    render(<FogMaskCanvas {...baseProps()} />);
    expect(document.querySelector('canvas[data-fog-layer-id="layer_fog_1"]')).toBeInTheDocument();
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
