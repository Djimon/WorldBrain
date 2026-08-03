// M16-S03 (#324): loads ALL entities + relations + mention edges, builds the
// full GraphModel (S02 #317), and hands the COMPLETE model to GraphCanvas —
// the single shared renderer core (D12). Ego (S07 #321) will hand the same
// GraphCanvas only { focus + N neighbors } — no separate renderer.
//
// S06 (#319): GraphControlsBar manages { mode, showMentions, glowEnabled }.
// Start-Default: Galaxy (D4). mention-Links werden clientseitig gefiltert —
// das Modell bleibt unverändert, nur die an GraphCanvas gereichten Links
// werden beim Rendern gefiltert.
import { useEffect, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphLink, GraphModel } from '../services/graph-model';
import { edgeStyle, nodeStyle } from '../services/graph-style';
import { GraphCanvas } from './GraphCanvas';
import { GraphControlsBar } from './GraphControlsBar';

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

export function GlobalGraphView({ database, onNavigate }: GlobalGraphViewProps): React.ReactElement {
  const [model, setModel] = useState<GraphModel | null>(null);
  // D4: Galaxy is the start default (shows cluster structure immediately).
  const [mode, setMode] = useState<'galaxy' | 'ring'>('galaxy');
  const [showMentions, setShowMentions] = useState(true);
  const [glowEnabled, setGlowEnabled] = useState(false);

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

  const visibleLinks: GraphLink[] = showMentions
    ? model.links
    : model.links.filter((l) => l.kind !== 'mention');

  return (
    <div className="graph-view" style={{ width: '100%', height: '100%' }}>
      <GraphControlsBar
        mode={mode}
        showMentions={showMentions}
        glowEnabled={glowEnabled}
        onModeChange={setMode}
        onShowMentionsChange={setShowMentions}
        onGlowChange={setGlowEnabled}
      />
      <GraphCanvas
        nodes={model.nodes}
        links={visibleLinks}
        nodeStyle={(node) => nodeStyle(node, degreeRange)}
        edgeStyle={edgeStyle}
        layout={{ mode, clusterStrength: GALAXY_CLUSTER_STRENGTH }}
        glowEnabled={glowEnabled}
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default GlobalGraphView;
