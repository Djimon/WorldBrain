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
import { useTranslation } from 'react-i18next';
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
import { EntityDetailView } from './EntityDetailView';

export interface GlobalGraphViewProps {
  database: DatabaseLike;
  onNavigate: (id: string) => void;
  // Ego mode: render only the focus entity + its 1-hop neighborhood. Uses the
  // exact same view + the user's saved settings; only edges + bloom are forced
  // on. Undefined = full global graph.
  egoFocusId?: string;
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

export function GlobalGraphView({ database, onNavigate, egoFocusId }: GlobalGraphViewProps): React.ReactElement {
  const { t } = useTranslation('nav');
  const [model, setModel] = useState<GraphModel | null>(null);
  // Click a node -> preview in a side panel (stay in the graph), NOT a full
  // area switch. The panel offers an explicit "open" to navigate for real.
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      const relationLinks = relations.map((r) => ({ source: r.source_id, target: r.target_id, relation_type: r.relation_type }));
      setModel(buildGraphModel(entities, relationLinks, mentionLinks));
    }).catch(console.error);
    return () => { cancelled = true; };
  }, [database]);

  // Ego mode: reduce the model to the focus + its 1-hop neighborhood. Full
  // mode: the whole model. Everything downstream is identical.
  const base = useMemo<{ nodes: GraphNode[]; links: GraphLink[] }>(() => {
    if (!model) return { nodes: [], links: [] };
    if (!egoFocusId) return { nodes: model.nodes, links: model.links };
    const adj = new Map<string, Set<string>>();
    for (const l of model.links) {
      (adj.get(l.source) ?? adj.set(l.source, new Set()).get(l.source)!).add(l.target);
      (adj.get(l.target) ?? adj.set(l.target, new Set()).get(l.target)!).add(l.source);
    }
    const seen = new Set<string>([egoFocusId, ...(adj.get(egoFocusId) ?? [])]);
    return {
      nodes: model.nodes.filter((n) => seen.has(n.id)),
      links: model.links.filter((l) => seen.has(l.source) && seen.has(l.target)),
    };
  }, [model, egoFocusId]);

  // 3D layout computed ONCE per (sub)model (also feeds cluster coloring).
  const positions = useMemo<GraphPosition[]>(
    () => computeGalaxyLayout3D(base.nodes, base.links).map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z })),
    [base],
  );
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  // Degree from the VISIBLE links (mentions on -> counted, off -> relations
  // only), so toggling "Mentions zeigen" rescales the spheres live.
  const links = useMemo<GraphLink[]>(
    () => (settings.showMentions ? base.links : base.links.filter((l) => l.kind !== 'mention')),
    [base, settings.showMentions],
  );
  const degreeByVisible = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of links) {
      m.set(l.source, (m.get(l.source) ?? 0) + 1);
      m.set(l.target, (m.get(l.target) ?? 0) + 1);
    }
    return m;
  }, [links]);
  const maxDeg = useMemo(() => {
    let mx = 1;
    for (const v of degreeByVisible.values()) if (v > mx) mx = v;
    return mx;
  }, [degreeByVisible]);

  const nodeStyle = useCallback(
    (n: GraphNode) => {
      const deg = degreeByVisible.get(n.id) ?? 0;
      const radius = Math.max(SIZE_MIN, SIZE_MID * Math.pow(1 + SIZE_SPREAD, Math.sqrt(deg / maxDeg) - 0.5));
      if (settings.colorMode === 'cluster') {
        const p = posById.get(n.id);
        return { color: p ? positionColor(p.x, p.y, p.z) : typeColor(n.type), radius };
      }
      return { color: typeColor(n.type), radius };
    },
    [settings.colorMode, posById, degreeByVisible, maxDeg],
  );

  const mentionColorNum = hexToNum(settings.mentionColor);
  const relationColorNum = hexToNum(settings.relationColor);
  const styledEdge = useCallback(
    (l: GraphLink) => (l.kind === 'mention'
      ? { ...edgeStyle(l), color: mentionColorNum }
      : { ...edgeStyle(l), color: relationColorNum }),
    [mentionColorNum, relationColorNum],
  );

  if (!model) return <div className="graph-view graph-view--loading" style={{ width: '100%', height: '100%' }} />;

  return (
    <div className="graph-view" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GraphCanvas
        nodes={base.nodes}
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
        glowEnabled={egoFocusId ? true : settings.glow}
        edgesHidden={egoFocusId ? false : !settings.showAllEdges}
        alwaysShowChips={!!egoFocusId}
        edgeRevealDepth={1}
        relationForm={settings.relationForm}
        mentionForm={settings.mentionForm}
        onNavigate={setSelectedId}
      />

      {selectedId && (
        <div style={{
          position: 'absolute', top: 12, right: 12, width: 360, maxHeight: 'calc(100% - 24px)',
          overflow: 'auto', zIndex: 6, background: 'rgba(18,22,28,0.96)', color: '#e8eef5',
          borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: 8, position: 'sticky', top: 0, background: 'inherit' }}>
            <button
              onClick={() => onNavigate(selectedId)}
              style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: '#3a6ea5', color: '#fff' }}
            >{t('graphOpenEntity', 'Öffnen')}</button>
            <button
              onClick={() => setSelectedId(null)}
              aria-label={t('graphCloseDetail', 'Schließen')}
              style={{ padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#e8eef5' }}
            >×</button>
          </div>
          <div style={{ padding: '0 10px 12px' }}>
            <EntityDetailView entityId={selectedId} database={database} onNavigateToEntity={setSelectedId} />
          </div>
        </div>
      )}

      <GraphSettingsPanel value={settings} onChange={patch} />
    </div>
  );
}

export default GlobalGraphView;
