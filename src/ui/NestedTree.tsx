// #305: Gemeinsame Baum-Komponente — generisch, ohne Wissen über Pins oder Maps.
// Adapter-Schnittstelle kapselt Datenmodell-Unterschiede:
//   fromPathStrings  → Pin-Ordner (group_name via "/")
//   fromParentId     → Map-Ordner (map_folders.parent_id)

import { useState } from 'react';

export interface NestedTreeNode {
  id: string;
  label: string;
  children?: NestedTreeNode[];
  itemCount?: number;
}

export interface NestedTreeProps {
  nodes: NestedTreeNode[];
  onMove?: (nodeId: string, targetId: string | null) => void;
  renderLeaf?: (node: NestedTreeNode) => React.ReactNode;
  searchable?: boolean;
}

function getAllIds(nodes: NestedTreeNode[]): string[] {
  return nodes.flatMap((n) => [n.id, ...getAllIds(n.children ?? [])]);
}

function filterNodes(nodes: NestedTreeNode[], q: string): NestedTreeNode[] {
  return nodes.flatMap((node) => {
    const matches = node.label.toLowerCase().includes(q);
    const filteredChildren = node.children ? filterNodes(node.children, q) : undefined;
    const childMatches = (filteredChildren?.length ?? 0) > 0;
    if (matches || childMatches) return [{ ...node, children: filteredChildren }];
    return [];
  });
}

interface NodeRowProps {
  node: NestedTreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onMove?: (draggedId: string, targetId: string | null) => void;
  onDropOnNode: (draggedId: string, targetId: string) => void;
  renderLeaf?: (node: NestedTreeNode) => React.ReactNode;
}

function NodeRow({ node, depth, collapsed, onToggle, onMove, onDropOnNode, renderLeaf }: NodeRowProps) {
  const isOpen = !collapsed.has(node.id);
  const hasChildren = (node.children?.length ?? 0) > 0;

  return (
    <div style={{ paddingLeft: depth * 14 }}>
      <div
        draggable={onMove ? true : undefined}
        onDragStart={(e) => { e.dataTransfer.setData('text/plain', node.id); e.stopPropagation(); }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={(e) => {
          e.stopPropagation();
          const id = e.dataTransfer.getData('text/plain');
          if (id && id !== node.id) onDropOnNode(id, node.id);
        }}
        className="nested-tree__node-header"
      >
        {hasChildren ? (
          <button
            aria-label={node.label}
            className="nested-tree__toggle"
            onClick={() => onToggle(node.id)}
          >
            <span aria-hidden="true">{isOpen ? '▼' : '▶'} </span>
            <span>{node.label}</span>
          </button>
        ) : renderLeaf ? (
          renderLeaf(node)
        ) : (
          <span className="nested-tree__node-label">{node.label}</span>
        )}
        {node.itemCount !== undefined && (
          <span className="nested-tree__count">{node.itemCount}</span>
        )}
        {onMove && (
          <button
            aria-label="verschieben"
            className="nested-tree__move-btn"
            onClick={() => onMove(node.id, null)}
          >
            ↕
          </button>
        )}
      </div>
      {isOpen && hasChildren && node.children!.map((child) => (
        <NodeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          collapsed={collapsed}
          onToggle={onToggle}
          onMove={onMove}
          onDropOnNode={onDropOnNode}
          renderLeaf={renderLeaf}
        />
      ))}
    </div>
  );
}

export function NestedTree({ nodes, onMove, renderLeaf, searchable }: NestedTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(getAllIds(nodes)));
  const [search, setSearch] = useState('');

  function toggle(id: string) {
    setCollapsed((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  const q = search.trim().toLowerCase();
  const visible = q ? filterNodes(nodes, q) : nodes;

  return (
    <div
      className="nested-tree"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/plain');
        if (id) onMove?.(id, null);
      }}
    >
      {searchable && (
        <input
          role="searchbox"
          type="search"
          className="nested-tree__search"
          placeholder="Suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      {visible.map((node) => (
        <NodeRow
          key={node.id}
          node={node}
          depth={0}
          collapsed={collapsed}
          onToggle={toggle}
          onMove={onMove}
          onDropOnNode={(draggedId, targetId) => onMove?.(draggedId, targetId)}
          renderLeaf={renderLeaf}
        />
      ))}
    </div>
  );
}

// ── Adapters ──────────────────────────────────────────────────────────────────

export function fromPathStrings(
  items: Array<{ id: string; path: string; label: string }>,
): NestedTreeNode[] {
  const nodeMap = new Map<string, NestedTreeNode>();

  for (const item of items) {
    nodeMap.set(item.path, { id: item.id, label: item.label, children: [] });
  }

  const roots: NestedTreeNode[] = [];

  for (const item of items) {
    const segments = item.path.split('/');
    if (segments.length === 1) {
      roots.push(nodeMap.get(item.path)!);
    } else {
      const parentPath = segments.slice(0, -1).join('/');
      nodeMap.get(parentPath)?.children?.push(nodeMap.get(item.path)!);
    }
  }

  for (const node of nodeMap.values()) {
    if (node.children?.length === 0) node.children = undefined;
  }

  return roots;
}

export function fromParentId(
  items: Array<{ id: string; parent_id: string | null; label: string; itemCount?: number }>,
): NestedTreeNode[] {
  const nodeMap = new Map<string, NestedTreeNode>();

  for (const item of items) {
    nodeMap.set(item.id, { id: item.id, label: item.label, itemCount: item.itemCount, children: [] });
  }

  const roots: NestedTreeNode[] = [];

  for (const item of items) {
    const node = nodeMap.get(item.id)!;
    if (item.parent_id === null) {
      roots.push(node);
    } else {
      nodeMap.get(item.parent_id)?.children?.push(node);
    }
  }

  for (const node of nodeMap.values()) {
    if (node.children?.length === 0) node.children = undefined;
  }

  return roots;
}
