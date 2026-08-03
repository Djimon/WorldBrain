// M16-S03 (#324): loads ALL entities + relations + mention edges, builds the
// full GraphModel (S02 #317), and hands the COMPLETE model to GraphCanvas —
// the single shared renderer core (D12). Ego (S07 #321) will hand the same
// GraphCanvas only { focus + N neighbors } — no separate renderer.
//
// Implementation contract: listEntitiesByType (or an all-entities listing)
// + getAllRelations(db) (relation-service.ts) + buildMentionEdges(entities)
// (mention-graph.ts, S01 #288) -> buildGraphModel(...) (graph-model.ts, S02
// #317) -> { nodes, links }. degree + D9 subsumption come from S02, not
// rebuilt here.
import { useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphModel } from '../services/graph-model';
import { edgeStyle, nodeStyle } from '../services/graph-style';
import { GraphCanvas } from './GraphCanvas';

export interface GlobalGraphViewProps {
  database: DatabaseLike;
  onNavigate: (id: string) => void;
}

interface EntityRow {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  properties_json: string | null;
  body_json: string | null;
}

export function GlobalGraphView({ database, onNavigate }: GlobalGraphViewProps): React.ReactElement {
  const [model, setModel] = useState<GraphModel | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      database.select<EntityRow>('SELECT id, type, title, summary, properties_json, body_json FROM base_entities'),
      getAllRelations(database),
    ]).then(([entities, relations]) => {
      if (cancelled) return;
      const mentionLinks = buildMentionEdges(entities);
      const relationLinks = relations.map((r) => ({ source: r.source_id, target: r.target_id }));
      setModel(buildGraphModel(entities, relationLinks, mentionLinks));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [database]);

  if (!model) return <div className="graph-view graph-view--loading" />;

  const degrees = model.nodes.map((n) => n.degree);
  const degreeRange = {
    min: degrees.length ? Math.min(...degrees) : 0,
    max: degrees.length ? Math.max(...degrees) : 0,
  };

  return (
    <div className="graph-view" style={{ width: '100%', height: '100%' }}>
      <GraphCanvas
        nodes={model.nodes}
        links={model.links}
        nodeStyle={(node) => nodeStyle(node, degreeRange)}
        edgeStyle={edgeStyle}
        layout={{ mode: 'force' }}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default GlobalGraphView;
