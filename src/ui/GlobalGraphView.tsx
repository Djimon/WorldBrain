// M16-S03 (#324): loads ALL entities + relations + mention edges, builds the
// full GraphModel (S02 #317), and hands the COMPLETE model to GraphCanvas —
// the single shared renderer core (D12). Ego (S07 #321) will hand the same
// GraphCanvas only { focus + N neighbors }.
//
// No controls UI for now (the old GraphControlsBar was removed on request —
// new controls come later). The final tuned look lives in GraphCanvas
// (DEFAULT_LOOK); this view just bakes the behavioural choices: glow on,
// edges hidden (reveal 1-hop neighborhood on hover/click), size-spread by
// degree.
import { useCallback, useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphModel, GraphNode } from '../services/graph-model';
import { edgeStyle, typeColor } from '../services/graph-style';
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

const GALAXY_CLUSTER_STRENGTH = 0.3;
const GALAXY_CHARGE_STRENGTH = -200;
const GALAXY_LINK_DISTANCE = 80;
// Size-spread by degree (tuned): radius = 12 * (1+spread)^(degreeNorm - 0.5).
const SIZE_SPREAD = 30;
const SIZE_MID = 12;

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

  const maxDeg = model ? Math.max(1, ...model.nodes.map((n) => n.degree)) : 1;
  const nodeStyle = useCallback(
    (n: GraphNode) => ({
      color: typeColor(n.type),
      radius: SIZE_MID * Math.pow(1 + SIZE_SPREAD, Math.sqrt(n.degree / maxDeg) - 0.5),
    }),
    [maxDeg],
  );

  if (!model) return <div className="graph-view graph-view--loading" style={{ width: '100%', height: '100%' }} />;

  return (
    <div className="graph-view" style={{ width: '100%', height: '100%' }}>
      <GraphCanvas
        nodes={model.nodes}
        links={model.links}
        nodeStyle={nodeStyle}
        edgeStyle={edgeStyle}
        layout={{
          mode: 'galaxy',
          clusterStrength: GALAXY_CLUSTER_STRENGTH,
          chargeStrength: GALAXY_CHARGE_STRENGTH,
          linkDistance: GALAXY_LINK_DISTANCE,
        }}
        glowEnabled
        edgesHidden
        edgeRevealDepth={1}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default GlobalGraphView;
