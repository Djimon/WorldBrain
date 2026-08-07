// M16-S03 (#324): loads ALL entities + relations + mention edges, builds the
// full GraphModel (S02 #317), and hands the COMPLETE model to GraphCanvas —
// the single shared renderer core (D12). Ego (S07 #321) will hand the same
// GraphCanvas only { focus + N neighbors }.
//
// Settings live in a small gear panel (GraphSettingsPanel, bottom right). The
// final tuned look lives in GraphCanvas (DEFAULT_LOOK); this view owns the
// behavioural settings + baked size-spread. The 3D layout is computed ONCE
// here and passed to GraphCanvas (also feeds the spatial "cluster" coloring),
// so toggling settings never recomputes the force sim.
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphLink, GraphModel, GraphNode } from '../services/graph-model';
import { edgeStyle, positionColor, typeColor } from '../services/graph-style';
import { computeGalaxyLayout3D } from '../services/galaxy-layout';
import { GraphCanvas } from './GraphCanvas';
import type { GraphPosition } from './GraphCanvas';
import { GraphSettingsPanel } from './GraphSettingsPanel';
import type { GraphSettings } from './GraphSettingsPanel';

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
// Size-spread by degree (tuned): radius = 12 * (1+spread)^(degreeNorm - 0.5),
// floored at SIZE_MIN so unconnected/low-degree nodes stay visible (they'd be
// ~1px otherwise). Floor makes the smallest ~5x bigger than the raw formula.
const SIZE_SPREAD = 30;
const SIZE_MID = 12;
const SIZE_MIN = 11;

const DEFAULT_SETTINGS: GraphSettings = {
  colorMode: 'entity',
  glow: false,
  showAllEdges: false,
  showMentions: true,
  mentionColor: '#ff3b30',
  relationColor: '#d0d0d0',
  mentionForm: 'solid',
  relationForm: 'solid',
};

function hexToNum(hex: string): number {
  return parseInt(hex.replace('#', ''), 16) || 0;
}

// Persist graph settings across sessions (localStorage — same convention as
// theme/lang). Global, not per-project. Merge over defaults so newly added
// keys still resolve for older stored blobs.
const SETTINGS_KEY = 'graph-settings';
function loadSettings(): GraphSettings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SETTINGS_KEY) : null;
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GraphSettings>) };
  } catch { /* storage unavailable / bad json — fall back to defaults */ }
  return DEFAULT_SETTINGS;
}

export function GlobalGraphView({ database, onNavigate }: GlobalGraphViewProps): React.ReactElement {
  const [model, setModel] = useState<GraphModel | null>(null);
  const [settings, setSettings] = useState<GraphSettings>(loadSettings);
  const patch = useCallback((p: Partial<GraphSettings>) => setSettings((s) => {
    const next = { ...s, ...p };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    return next;
  }), []);

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

  // 3D layout computed ONCE per model (also feeds cluster coloring).
  const positions = useMemo<GraphPosition[]>(() => {
    if (!model) return [];
    return computeGalaxyLayout3D(model.nodes, model.links).map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z }));
  }, [model]);
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);
  const maxDeg = useMemo(() => (model ? Math.max(1, ...model.nodes.map((n) => n.degree)) : 1), [model]);

  const nodeStyle = useCallback(
    (n: GraphNode) => {
      const radius = Math.max(SIZE_MIN, SIZE_MID * Math.pow(1 + SIZE_SPREAD, Math.sqrt(n.degree / maxDeg) - 0.5));
      if (settings.colorMode === 'cluster') {
        const p = posById.get(n.id);
        return { color: p ? positionColor(p.x, p.y, p.z) : typeColor(n.type), radius };
      }
      return { color: typeColor(n.type), radius };
    },
    [settings.colorMode, posById, maxDeg],
  );

  const mentionColorNum = hexToNum(settings.mentionColor);
  const relationColorNum = hexToNum(settings.relationColor);
  const styledEdge = useCallback(
    (l: GraphLink) => (l.kind === 'mention'
      ? { ...edgeStyle(l), color: mentionColorNum }
      : { ...edgeStyle(l), color: relationColorNum }),
    [mentionColorNum, relationColorNum],
  );

  const links = useMemo<GraphLink[]>(
    () => (model ? (settings.showMentions ? model.links : model.links.filter((l) => l.kind !== 'mention')) : []),
    [model, settings.showMentions],
  );

  if (!model) return <div className="graph-view graph-view--loading" style={{ width: '100%', height: '100%' }} />;

  return (
    <div className="graph-view" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GraphCanvas
        nodes={model.nodes}
        links={links}
        positions={positions}
        nodeStyle={nodeStyle}
        edgeStyle={styledEdge}
        layout={{
          mode: 'galaxy',
          clusterStrength: GALAXY_CLUSTER_STRENGTH,
          chargeStrength: GALAXY_CHARGE_STRENGTH,
          linkDistance: GALAXY_LINK_DISTANCE,
        }}
        glowEnabled={settings.glow}
        edgesHidden={!settings.showAllEdges}
        edgeRevealDepth={1}
        relationForm={settings.relationForm}
        mentionForm={settings.mentionForm}
        onNavigate={onNavigate}
      />
      <GraphSettingsPanel value={settings} onChange={patch} />
    </div>
  );
}

export default GlobalGraphView;
