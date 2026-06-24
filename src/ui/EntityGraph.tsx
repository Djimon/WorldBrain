import React, { useEffect, useRef, useState } from 'react';
import Cytoscape from 'cytoscape';
import { getRelations, RelationRow } from '../services/relation-service';
import { getAllRelationTypes } from '../data/relation-type-registry';

export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation_type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildGraphData(rootEntityId: string, relations: RelationRow[]): GraphData {
  const nodeIds = new Set<string>([rootEntityId]);
  const edges: GraphEdge[] = [];

  for (const rel of relations) {
    nodeIds.add(rel.source_id);
    nodeIds.add(rel.target_id);
    edges.push({
      source: rel.source_id,
      target: rel.target_id,
      relation_type: rel.relation_type,
    });
  }

  return {
    nodes: Array.from(nodeIds).map((id) => ({ id })),
    edges,
  };
}

interface Props {
  entityId: string;
  database?: unknown;
  onNavigate?: (entityId: string) => void;
}

export function EntityGraph({ entityId, database = null, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [depth, setDepth] = useState(1);
  const [showInactive, setShowInactive] = useState(false);
  const allTypes = getAllRelationTypes();
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(
    new Set(allTypes.map((t) => t.relation_type))
  );

  const relations = getRelations(database as never, entityId, { includeInactive: showInactive });
  const graphData = buildGraphData(entityId, relations);

  useEffect(() => {
    if (!containerRef.current) return;

    const elements = [
      ...graphData.nodes.map((n) => ({ data: { id: n.id } })),
      ...graphData.edges.map((e) => ({ data: { source: e.source, target: e.target, relation_type: e.relation_type } })),
    ];

    const cy = Cytoscape({
      container: containerRef.current,
      elements,
      layout: { name: 'grid' },
    } as never);

    cy.on('tap', (e: { target: { id?: () => string } }) => {
      const id = e.target.id?.();
      if (id && onNavigate) onNavigate(id);
    });

    return () => { cy.destroy(); };
  }, [entityId, depth, showInactive, selectedTypes]);

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div>
      <div data-entity-id={entityId} data-root style={{ display: 'none' }} />

      <div>
        <label htmlFor="graph-depth">Depth</label>
        <select
          id="graph-depth"
          aria-label="depth"
          value={depth}
          onChange={(e) => setDepth(Number(e.target.value))}
        >
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      </div>

      <fieldset role="group" aria-label="Filter by relation type">
        <legend>Relation type filter</legend>
        {allTypes.map((t) => (
          <label key={t.relation_type}>
            <input
              type="checkbox"
              checked={selectedTypes.has(t.relation_type)}
              onChange={() => toggleType(t.relation_type)}
            />
            {t.label}
          </label>
        ))}
      </fieldset>

      <label>
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          aria-label="Show inactive relations"
        />
        Show inactive
      </label>

      <div ref={containerRef} style={{ width: '100%', height: 400 }} />
    </div>
  );
}
