// M16-S07 (#321): Ego-Graph als Tab in der Entity-Detail-Ansicht. Genau der
// GlobalGraph, nur mit einem BFS-Subgraphen (Fokus-Entity + N-Hop-Nachbarn) —
// D12: derselbe GraphCanvas-Renderer, der Aufrufer entscheidet nur die Daten.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphLink, GraphModel, GraphNode } from '../services/graph-model';
import { edgeStyle, typeColor } from '../services/graph-style';
import { computeGalaxyLayout3D } from '../services/galaxy-layout';
import { GraphCanvas } from './GraphCanvas';
import type { GraphPosition } from './GraphCanvas';

export interface EntityGraphTabProps {
  entityId: string;
  database: DatabaseLike;
  onNavigate?: (id: string) => void;
}

interface EntityRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  properties_json: string | null;
  body_json: string | null;
}

const SIZE_SPREAD = 6;
const SIZE_MID = 12;
const SIZE_MIN = 11;

export function EntityGraphTab({ entityId, database, onNavigate }: EntityGraphTabProps): React.ReactElement {
  const [model, setModel] = useState<GraphModel | null>(null);
  const [depth, setDepth] = useState(1);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      database.select<EntityRow>('SELECT id, type, title, summary, properties_json, body_json FROM base_entities'),
      getAllRelations(database),
    ]).then(([entities, relations]) => {
      if (cancelled) return;
      const mentionLinks = buildMentionEdges(entities);
      const relationLinks = relations.map((r) => ({ source: r.source_id, target: r.target_id, relation_type: r.relation_type }));
      setModel(buildGraphModel(entities, relationLinks, mentionLinks));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [database]);

  // BFS subgraph around the focus entity to `depth` hops (over relations+mentions).
  const sub = useMemo<{ nodes: GraphNode[]; links: GraphLink[] }>(() => {
    if (!model) return { nodes: [], links: [] };
    const adj = new Map<string, Set<string>>();
    for (const l of model.links) {
      (adj.get(l.source) ?? adj.set(l.source, new Set()).get(l.source)!).add(l.target);
      (adj.get(l.target) ?? adj.set(l.target, new Set()).get(l.target)!).add(l.source);
    }
    const seen = new Set<string>([entityId]);
    let frontier = [entityId];
    for (let d = 0; d < depth; d++) {
      const next: string[] = [];
      for (const f of frontier) for (const nb of adj.get(f) ?? []) if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
      frontier = next;
    }
    const nodes = model.nodes.filter((n) => seen.has(n.id));
    const links = model.links.filter((l) => seen.has(l.source) && seen.has(l.target));
    return { nodes, links };
  }, [model, entityId, depth]);

  const positions = useMemo<GraphPosition[]>(
    () => computeGalaxyLayout3D(sub.nodes, sub.links).map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z })),
    [sub],
  );
  const maxDeg = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of sub.links) { m.set(l.source, (m.get(l.source) ?? 0) + 1); m.set(l.target, (m.get(l.target) ?? 0) + 1); }
    let mx = 1;
    for (const v of m.values()) if (v > mx) mx = v;
    return mx;
  }, [sub]);
  const degOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of sub.links) { m.set(l.source, (m.get(l.source) ?? 0) + 1); m.set(l.target, (m.get(l.target) ?? 0) + 1); }
    return m;
  }, [sub]);

  const nodeStyle = useCallback((n: GraphNode) => {
    const deg = degOf.get(n.id) ?? 0;
    const radius = Math.max(SIZE_MIN, SIZE_MID * Math.pow(1 + SIZE_SPREAD, Math.sqrt(deg / maxDeg) - 0.5));
    return { color: typeColor(n.type), radius };
  }, [degOf, maxDeg]);

  const handleNav = useCallback((id: string) => { onNavigate?.(id); }, [onNavigate]);

  if (!model) return <div style={{ height: '70vh' }} />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '70vh', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ opacity: 0.7 }}>Tiefe</span>
        {[1, 2, 3].map((d) => (
          <button
            key={d}
            onClick={() => setDepth(d)}
            aria-pressed={depth === d}
            style={{
              padding: '2px 10px', borderRadius: 6, cursor: 'pointer', color: 'inherit',
              border: '1px solid rgba(128,128,128,0.4)',
              background: depth === d ? '#3a6ea5' : 'transparent',
            }}
          >{d}</button>
        ))}
        <span style={{ opacity: 0.6, marginLeft: 8 }}>{sub.nodes.length} Knoten</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden', background: '#37265a' }}>
        <GraphCanvas
          nodes={sub.nodes}
          links={sub.links}
          positions={positions}
          nodeStyle={nodeStyle}
          edgeStyle={edgeStyle}
          layout={{ mode: 'galaxy' }}
          edgesHidden={false}
          onNavigate={handleNav}
        />
      </div>
    </div>
  );
}

export default EntityGraphTab;
