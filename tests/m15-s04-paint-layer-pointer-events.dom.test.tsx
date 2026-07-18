// Regression: the grid PaintInteractionLayer used to keep pointer-events on
// even when inactive, so its full-size <svg> sat on top of the fog canvas and
// swallowed every click -> fog painting did nothing. It must be transparent to
// pointers unless grid-paint is active.

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaintInteractionLayer } from '../src/ui/MapGrid';

const base = {
  imgW: 1000, imgH: 800, cellSize: 50, type: 'square' as const,
  activeCellStateId: 1, cells: new Map<string, number>(),
  sessionId: 's', mapId: 'm', database: { execute: vi.fn(), select: vi.fn() } as never,
  onCellsChange: vi.fn(), onCellContextMenu: vi.fn(),
};

describe('PaintInteractionLayer pointer-events gating', () => {
  it('is pointer-events:none when inactive (does not block layers below, e.g. fog)', () => {
    const { container } = render(<PaintInteractionLayer {...base} active={false} />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.style.pointerEvents).toBe('none');
  });

  it('is pointer-events:auto when actively painting the grid', () => {
    const { container } = render(<PaintInteractionLayer {...base} active />);
    const svg = container.querySelector('svg') as SVGElement;
    expect(svg.style.pointerEvents).toBe('auto');
  });
});
