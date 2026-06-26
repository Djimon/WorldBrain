import { useEffect, useMemo, useRef, useState } from 'react';
import Cytoscape from 'cytoscape';
import { listEntitiesByType } from '../services/entity-service';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import type { RelationRow } from '../services/relation-service';
import { getAllRelationTypes } from '../data/relation-type-registry';

interface EntityListItem {
  id: string;
  type: string;
  title: string;
  summary: string;
}

interface Props {
  onNavigate: (entityId: string) => void;
  database?: DatabaseLike;
  initialConfig?: { entityTypes?: string[]; relationTypes?: string[] };
  onConfigChange?: (config: { entityTypes: string[]; relationTypes: string[] }) => void;
}

export function GlobalEntityGraph({ onNavigate, database, initialConfig, onConfigChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [allEntities, setAllEntities] = useState<EntityListItem[]>([]);
  const [allRelations, setAllRelations] = useState<RelationRow[]>([]);
  const relationTypeDefs = useMemo(() => getAllRelationTypes(), []);

  useEffect(() => {
    if (database) {
      listEntitiesByType({ database, type: null }).then(rows => setAllEntities(rows as EntityListItem[]));
      getAllRelations(database, { includeInactive: false }).then(setAllRelations);
    }
  }, [database]);

  const entityTypes = useMemo(
    () => [...new Set(allEntities.map((e) => e.type))],
    [allEntities],
  );

  const [selectedEntityTypes, setSelectedEntityTypes] = useState<Set<string>>(
    new Set(initialConfig?.entityTypes ?? []),
  );
  const [selectedRelTypes, setSelectedRelTypes] = useState<Set<string>>(
    new Set(initialConfig?.relationTypes ?? relationTypeDefs.map((r) => r.relation_type)),
  );

  function toggleEntityType(type: string) {
    setSelectedEntityTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleRelType(type: string) {
    setSelectedRelTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  useEffect(() => {
    if (!containerRef.current) return;
    let cy: cytoscape.Core | undefined;

    const nodes = allEntities
      .filter((e) => selectedEntityTypes.has(e.type))
      .map((e) => ({ data: { id: e.id, label: e.title, type: e.type } }));

    const edges = allRelations
      .filter((r) => selectedRelTypes.has(r.relation_type))
      .map((r) => ({ data: { id: r.id, source: r.source_id, target: r.target_id, label: r.relation_type } }));

    if (containerRef.current) {
      const canvasReady = (() => {
        try { return !!document.createElement('canvas').getContext('2d'); } catch { return false; }
      })();
      if (!canvasReady) return;

      cy = Cytoscape({
        container: containerRef.current,
        elements: [...nodes, ...edges],
        layout: { name: 'cose' },
      });
      cy.on('tap', 'node', (evt: { target: { id: () => string } }) => {
        onNavigate(evt.target.id());
      });
    }

    onConfigChange?.({
      entityTypes: [...selectedEntityTypes],
      relationTypes: [...selectedRelTypes],
    });

    return () => { cy?.destroy(); };
  }, [selectedEntityTypes, selectedRelTypes, allEntities, allRelations]);

  return (
    <div>
      <div>
        <strong>Entity Types</strong>
        {entityTypes.map((type) => (
          <label key={type}>
            <input
              type="checkbox"
              aria-label={type}
              checked={selectedEntityTypes.has(type)}
              onChange={() => toggleEntityType(type)}
            />
            {type}
          </label>
        ))}
      </div>
      <div>
        <strong>Relation Types</strong>
        {relationTypeDefs.map((rt) => (
          <label key={rt.relation_type}>
            <input
              type="checkbox"
              aria-label={rt.label}
              checked={selectedRelTypes.has(rt.relation_type)}
              onChange={() => toggleRelType(rt.relation_type)}
            />
            {rt.label}
          </label>
        ))}
      </div>
      <div ref={containerRef} style={{ width: '100%', height: 500 }} />
    </div>
  );
}
