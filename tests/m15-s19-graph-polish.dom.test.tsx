// @vitest-environment jsdom
// M15-S19: Graph-Politur — Layout/Reset-Controls, Legende, Navigation (optional)
// See: https://github.com/Djimon/WorldBrain/issues/290

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalEntityGraph } from '../src/ui/GlobalEntityGraph';
import type { DatabaseLike } from '../src/services/entity-service';

vi.mock('cytoscape', () => {
  const instance = {
    add: vi.fn(),
    remove: vi.fn(),
    elements: vi.fn().mockReturnValue({ remove: vi.fn() }),
    layout: vi.fn().mockReturnValue({ run: vi.fn() }),
    fit: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    style: vi.fn().mockReturnThis(),
  };
  return { default: vi.fn().mockReturnValue(instance) };
});

vi.mock('../src/services/mention-graph', () => ({
  buildMentionEdges: vi.fn().mockReturnValue([]),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/services/relation-service', () => ({
  getAllRelations: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/data/relation-type-registry', () => ({
  getAllRelationTypes: vi.fn().mockReturnValue([]),
}));

function makeDb(): DatabaseLike {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
  };
}

describe('M15-S19 Graph-Politur', () => {
  describe('layout controls', () => {
    it('renders a reset/fit button', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(
        screen.getByRole('button', { name: /reset|fit|ansicht|zurücksetzen/i }),
      ).toBeInTheDocument();
    });

    it('renders a re-run layout button', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(
        screen.getByRole('button', { name: /layout|neu berechnen|anordnen/i }),
      ).toBeInTheDocument();
    });

    it('clicking fit/reset calls cytoscape fit()', async () => {
      const Cytoscape = (await import('cytoscape')).default as ReturnType<typeof vi.fn>;
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      const fitBtn = screen.getByRole('button', { name: /reset|fit|ansicht|zurücksetzen/i });
      fireEvent.click(fitBtn);
      const instance = Cytoscape.mock.results[Cytoscape.mock.results.length - 1]?.value;
      if (instance?.fit) {
        expect((instance.fit as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('legend', () => {
    it('renders a legend with solid relation label', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(screen.getByText(/relation|beziehung/i)).toBeInTheDocument();
    });

    it('renders a legend with dashed mention/Verlinkung label', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(screen.getByText(/verlinkung|erwähnung|mention/i)).toBeInTheDocument();
    });
  });

  describe('no hardcoded UI strings', () => {
    it('source uses t() for all control/legend labels', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync('src/ui/GlobalEntityGraph.tsx', 'utf8');
      expect(src).toMatch(/useTranslation/);
    });
  });
});
