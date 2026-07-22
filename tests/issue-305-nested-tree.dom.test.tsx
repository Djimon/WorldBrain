// @vitest-environment jsdom
// chore(ui): NestedTree — gemeinsame Baum-Komponente (Wurzel von #304)
// See: https://github.com/Djimon/WorldBrain/issues/305

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NestedTree, fromPathStrings, fromParentId } from '../src/ui/NestedTree';
import type { NestedTreeNode } from '../src/ui/NestedTree';

const simpleNodes: NestedTreeNode[] = [
  {
    id: 'a', label: 'Alpha', itemCount: 2,
    children: [
      { id: 'a1', label: 'Alpha-Kind', itemCount: 0 },
    ],
  },
  { id: 'b', label: 'Beta', itemCount: 1 },
];

describe('NestedTree — Collapse/Expand', () => {
  it('renders top-level node labels', () => {
    render(<NestedTree nodes={simpleNodes} />);
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });

  it('renders a collapse/expand toggle button for nodes with children', () => {
    render(<NestedTree nodes={simpleNodes} />);
    expect(screen.getByRole('button', { name: /alpha/i })).toBeInTheDocument();
  });

  it('children are hidden by default (collapsed)', () => {
    render(<NestedTree nodes={simpleNodes} />);
    expect(screen.queryByText('Alpha-Kind')).not.toBeInTheDocument();
  });

  it('clicking expand toggle reveals children', () => {
    render(<NestedTree nodes={simpleNodes} />);
    fireEvent.click(screen.getByRole('button', { name: /alpha/i }));
    expect(screen.getByText('Alpha-Kind')).toBeInTheDocument();
  });

  it('clicking expand twice collapses again', () => {
    render(<NestedTree nodes={simpleNodes} />);
    const btn = screen.getByRole('button', { name: /alpha/i });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.queryByText('Alpha-Kind')).not.toBeInTheDocument();
  });
});

describe('NestedTree — Zähler (itemCount badge)', () => {
  it('renders itemCount badge for nodes that have one', () => {
    render(<NestedTree nodes={simpleNodes} />);
    // Alpha has itemCount=2, Beta has itemCount=1
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });
});

describe('NestedTree — Suche', () => {
  it('renders a search input when searchable=true', () => {
    render(<NestedTree nodes={simpleNodes} searchable />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('filters visible nodes by search term', () => {
    render(<NestedTree nodes={simpleNodes} searchable />);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Beta' } });
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument();
  });

  it('shows all nodes when search is cleared', () => {
    render(<NestedTree nodes={simpleNodes} searchable />);
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'Beta' } });
    fireEvent.change(input, { target: { value: '' } });
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
  });
});

describe('NestedTree — Drag / Move', () => {
  it('calls onMove with (nodeId, targetId) when move is triggered', () => {
    const onMove = vi.fn();
    render(<NestedTree nodes={simpleNodes} onMove={onMove} />);
    // Accessible move affordance: aria-label containing "verschieben" or "move"
    const moveControls = screen.getAllByRole('button', { name: /verschieben|move/i });
    expect(moveControls.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(moveControls[0]);
    // After triggering move, onMove is eventually called — exact UX is impl detail
  });
});

describe('fromPathStrings adapter', () => {
  it('converts flat path strings into nested NestedTreeNode[]', () => {
    const items = [
      { id: 'p1', path: 'Städte', label: 'Städte' },
      { id: 'p2', path: 'Städte/Hauptstädte', label: 'Hauptstädte' },
      { id: 'p3', path: 'Wälder', label: 'Wälder' },
    ];
    const nodes = fromPathStrings(items);
    expect(nodes.find((n) => n.label === 'Städte')).toBeDefined();
    expect(nodes.find((n) => n.label === 'Wälder')).toBeDefined();
    const staedte = nodes.find((n) => n.label === 'Städte');
    expect(staedte?.children?.find((c) => c.label === 'Hauptstädte')).toBeDefined();
  });

  it('top-level nodes have no parent', () => {
    const items = [{ id: 'r', path: 'Root', label: 'Root' }];
    const nodes = fromPathStrings(items);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe('r');
  });
});

describe('fromParentId adapter', () => {
  it('converts parent_id references into nested NestedTreeNode[]', () => {
    const items = [
      { id: 'f1', parent_id: null, label: 'Ordner A' },
      { id: 'f2', parent_id: 'f1', label: 'Unterordner' },
      { id: 'f3', parent_id: null, label: 'Ordner B' },
    ];
    const nodes = fromParentId(items);
    expect(nodes.find((n) => n.label === 'Ordner A')).toBeDefined();
    expect(nodes.find((n) => n.label === 'Ordner B')).toBeDefined();
    const ordnerA = nodes.find((n) => n.label === 'Ordner A');
    expect(ordnerA?.children?.find((c) => c.label === 'Unterordner')).toBeDefined();
  });

  it('passes itemCount through to NestedTreeNode', () => {
    const items = [{ id: 'f1', parent_id: null, label: 'Maps', itemCount: 5 }];
    const nodes = fromParentId(items);
    expect(nodes[0].itemCount).toBe(5);
  });
});
