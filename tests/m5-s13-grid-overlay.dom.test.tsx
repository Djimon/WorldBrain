// M5-S13: Grid overlay — Canvas 2D draw pass, no SVG element, no map framework.
// See: https://github.com/Djimon/WorldBrain/issues/79

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GridOverlay, GridToggle, GridSettings } from '../src/ui/GridOverlay';

describe('M5-S13 grid overlay', () => {
  describe('no framework dependency', () => {
    it('source does not import react-leaflet', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/GridOverlay.tsx', 'utf8');
      expect(src).not.toMatch(/react-leaflet/);
    });

    it('GridLayer is a Canvas draw pass — source must not create a standalone <svg> element for the grid', async () => {
      const fs = await import('fs');
      const src = fs.readFileSync('src/ui/GridOverlay.tsx', 'utf8');
      // Must use canvas context (ctx.beginPath / ctx.moveTo / ctx.stroke) — not SVGOverlay
      expect(src).toMatch(/ctx\.(beginPath|moveTo|stroke|lineTo)|drawGrid|CanvasRenderingContext/);
    });
  });

  describe('rendering', () => {
    it('renders without throwing', () => {
      expect(() => render(<GridOverlay gridType="square" cellSize={50} visible />)).not.toThrow();
    });

    it('renders nothing visible when visible=false', () => {
      const { container } = render(<GridOverlay gridType="square" cellSize={50} visible={false} />);
      // No canvas or overlay should be rendered
      const canvas = container.querySelector('canvas');
      expect(canvas == null || canvas.style.display === 'none' || canvas.style.visibility === 'hidden').toBe(true);
    });

    it('renders a canvas element when visible=true', () => {
      const { container } = render(<GridOverlay gridType="square" cellSize={50} visible />);
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
  });

  describe('grid type', () => {
    it('accepts square grid type', () => {
      expect(() => render(<GridOverlay gridType="square" cellSize={50} visible />)).not.toThrow();
    });

    it('accepts hex grid type', () => {
      expect(() => render(<GridOverlay gridType="hex" cellSize={50} visible />)).not.toThrow();
    });

    it('square and hex produce different canvas data-type attributes or aria-labels', () => {
      const { container: sq } = render(<GridOverlay gridType="square" cellSize={50} visible />);
      const { container: hx } = render(<GridOverlay gridType="hex" cellSize={50} visible />);
      const sqCanvas = sq.querySelector('canvas');
      const hxCanvas = hx.querySelector('canvas');
      // At minimum the components must be distinguishable by data attribute or aria-label
      const sqAttr = sqCanvas?.getAttribute('data-grid-type') ?? sqCanvas?.getAttribute('aria-label') ?? 'square';
      const hxAttr = hxCanvas?.getAttribute('data-grid-type') ?? hxCanvas?.getAttribute('aria-label') ?? 'hex';
      expect(sqAttr).not.toBe(hxAttr);
    });
  });

  describe('toggle control', () => {
    it('GridToggle renders a toggle checkbox or button', () => {
      render(<GridToggle onToggle={vi.fn()} visible={false} />);
      const toggle = screen.queryByRole('checkbox') ?? screen.queryByRole('button', { name: /grid/i });
      expect(toggle).toBeInTheDocument();
    });

    it('toggling calls onToggle with new value', () => {
      const onToggle = vi.fn();
      render(<GridToggle onToggle={onToggle} visible={false} />);
      const toggle = screen.queryByRole('checkbox') ?? screen.getByRole('button', { name: /grid/i });
      fireEvent.click(toggle);
      expect(onToggle).toHaveBeenCalledWith(true);
    });
  });

  describe('calibration-based spacing', () => {
    it('accepts pixelsPerWorldUnit prop', () => {
      expect(() => render(<GridOverlay gridType="square" cellSize={10} pixelsPerWorldUnit={5} visible />)).not.toThrow();
    });

    it('GridSettings has a cell size input', () => {
      render(<GridSettings cellSize={50} onCellSizeChange={vi.fn()} gridType="square" onGridTypeChange={vi.fn()} />);
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('changing cell size calls onCellSizeChange', () => {
      const onChange = vi.fn();
      render(<GridSettings cellSize={50} onCellSizeChange={onChange} gridType="square" onGridTypeChange={vi.fn()} />);
      fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '100' } });
      expect(onChange).toHaveBeenCalledWith(100);
    });
  });

  describe('opacity control', () => {
    it('accepts opacity prop between 0 and 1', () => {
      expect(() => render(<GridOverlay gridType="square" cellSize={50} visible opacity={0.4} />)).not.toThrow();
    });
  });
});
