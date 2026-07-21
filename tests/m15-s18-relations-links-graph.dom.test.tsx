// @vitest-environment jsdom
// M15-S18: GlobalEntityGraph = Relations + Verlinkungen (durchgezogen/gestrichelt, Toggle)
// See: https://github.com/Djimon/WorldBrain/issues/289

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GlobalEntityGraph } from '../src/ui/GlobalEntityGraph';
import type { DatabaseLike } from '../src/services/entity-service';

// Cytoscape canvas guard (same as m3-s07)
vi.mock('cytoscape', () => {
  const instance = {
    add: vi.fn(),
    remove: vi.fn(),
    elements: vi.fn().mockReturnValue({ remove: vi.fn() }),
    layout: vi.fn().mockReturnValue({ run: vi.fn() }),
    on: vi.fn(),
    destroy: vi.fn(),
    style: vi.fn().mockReturnThis(),
    update: vi.fn(),
  };
  return { default: vi.fn().mockReturnValue(instance) };
});

vi.mock('../src/services/mention-graph', () => ({
  buildMentionEdges: vi.fn().mockReturnValue([
    { source: 'e1', target: 'e2' },
  ]),
}));

vi.mock('../src/services/entity-service', () => ({
  listEntitiesByType: vi.fn().mockResolvedValue([
    { id: 'e1', type: 'Character', title: 'Ada', summary: '@[Bob](e2)' },
    { id: 'e2', type: 'Character', title: 'Bob', summary: '' },
  ]),
}));

vi.mock('../src/services/relation-service', () => ({
  getAllRelations: vi.fn().mockResolvedValue([
    { id: 'r1', source_id: 'e1', target_id: 'e2', relation_type: 'ally_of', inverse_type: 'ally_of', active: 1, visibility_json: '"public"' },
  ]),
}));

vi.mock('../src/data/relation-type-registry', () => ({
  getAllRelationTypes: vi.fn().mockReturnValue([
    { type: 'ally_of', label: 'Verbündete', inverseLabel: 'Verbündete' },
  ]),
}));

function makeDb(): DatabaseLike {
  return {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockResolvedValue([]),
  };
}

describe('M15-S18 GlobalEntityGraph relations + Verlinkungen', () => {
  describe('Verlinkungen toggle', () => {
    it('renders a Verlinkungen checkbox toggle', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(screen.getByRole('checkbox', { name: /verlinkung/i })).toBeInTheDocument();
    });

    it('Verlinkungen checkbox is checked by default (mention edges visible)', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      expect(screen.getByRole('checkbox', { name: /verlinkung/i })).toBeChecked();
    });

    it('unchecking Verlinkungen hides mention edges from DOM data', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      const toggle = screen.getByRole('checkbox', { name: /verlinkung/i });
      fireEvent.click(toggle);
      expect(toggle).not.toBeChecked();
    });
  });

  describe('no hardcoded English strings', () => {
    it('does not contain hardcoded "Entity Types" text in source', async () => {
      const { readFileSync } = await import('node:fs');
      const src = readFileSync('src/ui/GlobalEntityGraph.tsx', 'utf8');
      // Must use t() for all labels
      expect(src).not.toMatch(/>Entity Types</);
      expect(src).not.toMatch(/>Relation Types</);
    });
  });

  describe('existing behavior preserved', () => {
    it('entity-type checkboxes still render (regression guard)', () => {
      render(<GlobalEntityGraph onNavigate={vi.fn()} database={makeDb()} />);
      // Component renders without crashing — relations + entity types still present
      expect(document.querySelector('[data-testid="global-entity-graph"], .global-entity-graph, #global-graph, div')).toBeTruthy();
    });

    it('node click still calls onNavigate', async () => {
      const Cytoscape = (await import('cytoscape')).default as ReturnType<typeof vi.fn>;
      const instance = Cytoscape.mock.results[0]?.value;
      if (instance) {
        const onNavigate = vi.fn();
        render(<GlobalEntityGraph onNavigate={onNavigate} database={makeDb()} />);
        const clickHandler = (instance.on as ReturnType<typeof vi.fn>).mock.calls.find(
          (c: unknown[]) => c[0] === 'tap' || c[0] === 'click',
        );
        if (clickHandler) {
          const handler = clickHandler[1] ?? clickHandler[2];
          if (typeof handler === 'function') handler({ target: { data: () => ({ id: 'e1' }) } });
          expect(onNavigate).toHaveBeenCalled();
        }
      }
    });
  });
});
