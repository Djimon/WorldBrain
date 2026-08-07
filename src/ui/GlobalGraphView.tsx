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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DatabaseLike } from '../services/entity-service';
import { getAllRelations } from '../services/relation-service';
import { buildMentionEdges } from '../services/mention-graph';
import { buildGraphModel } from '../services/graph-model';
import type { GraphLink, GraphModel, GraphNode } from '../services/graph-model';
import { edgeStyle, positionColor, typeColor } from '../services/graph-style';
import { computeGalaxyLayout3D } from '../services/galaxy-layout';
import { computeRingLayout } from '../services/ring-layout';
import { GraphCanvas } from './GraphCanvas';
import type { GraphPosition } from './GraphCanvas';
import { GraphSettingsPanel } from './GraphSettingsPanel';
import type { GraphSettings } from './GraphSettingsPanel';
import { GraphFilterPanel } from './GraphFilterPanel';
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
  layoutMode: 'galaxy',
  colorMode: 'entity',
  glow: false,
  showAllEdges: false,
  showMentions: true,
  mentionColor: '#ff3b30',
  relationColor: '#d0d0d0',
  mentionForm: 'solid',
  relationForm: 'solid',
  hiddenRelationTypes: [],
  ringFill: 'organic',
  ringSpacing: 1,
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
  const [query, setQuery] = useState('');
  const [focusReq, setFocusReq] = useState<{ id: string; nonce: number } | undefined>(undefined);
  const focusNonce = useRef(0);
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

  // Ego always uses Galaxy (a ring of one Area is pointless). Otherwise follow
  // the persisted layout toggle.
  const layoutMode = egoFocusId ? 'galaxy' : settings.layoutMode;

  // Both layouts computed ONCE per (sub)model. Ring is flat (z=0), fixed
  // positions (S05 #290); Galaxy is the 3D force layout (S04). The active set
  // also feeds the spatial "cluster" coloring.
  const galaxyPositions = useMemo<GraphPosition[]>(
    () => computeGalaxyLayout3D(base.nodes, base.links).map((p) => ({ id: p.id, x: p.x, y: p.y, z: p.z })),
    [base],
  );
  const ringPositions = useMemo<GraphPosition[]>(() => {
    if (layoutMode !== 'ring') return [];
    const m = computeRingLayout(base.nodes, base.links, { fill: settings.ringFill });
    return base.nodes.map((n) => { const p = m.get(n.id); return { id: n.id, x: p?.x ?? 0, y: p?.y ?? 0, z: 0 }; });
  }, [layoutMode, base, settings.ringFill]);
  const positions = layoutMode === 'ring' ? ringPositions : galaxyPositions;

  // Disc size grows so node spacing stays usable: ~sqrt(N) keeps density
  // constant, times the user's spacing knob, times extra room when one Area
  // dominates (>50% -> would exceed 180deg). Grows past the viewport -> zoom/pan.
  const ringSpread = useMemo(() => {
    if (layoutMode !== 'ring') return 1;
    const n = base.nodes.length || 1;
    const counts = new Map<string, number>();
    for (const nd of base.nodes) counts.set(nd.type, (counts.get(nd.type) ?? 0) + 1);
    let maxFrac = 0;
    for (const c of counts.values()) maxFrac = Math.max(maxFrac, c / n);
    let s = settings.ringSpacing * Math.sqrt(n / 200);
    if (maxFrac > 0.5) s *= maxFrac / 0.5;
    return Math.max(0.3, s);
  }, [layoutMode, base.nodes, settings.ringSpacing]);
  const posById = useMemo(() => new Map(positions.map((p) => [p.id, p])), [positions]);

  // all relation_type values present (dynamic) -> filter pane checkboxes.
  const relationTypes = useMemo(() => {
    const s = new Set<string>();
    for (const l of base.links) if (l.kind === 'relation' && l.relation_type) s.add(l.relation_type);
    return [...s].sort();
  }, [base]);
  const hiddenSet = useMemo(() => new Set(settings.hiddenRelationTypes), [settings.hiddenRelationTypes]);

  // VISIBLE links: mentions gated by "Mentions zeigen", relations dropped when
  // their type is filtered out (independent of showAllEdges). Degree (and thus
  // sphere size) follows the visible set.
  const links = useMemo<GraphLink[]>(
    () => base.links.filter((l) => (l.kind === 'mention'
      ? settings.showMentions
      : !hiddenSet.has(l.relation_type ?? ''))),
    [base, settings.showMentions, hiddenSet],
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

  // local name autocomplete over the (sub)graph nodes.
  const suggestions = useMemo<GraphNode[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return base.nodes.filter((n) => n.label.toLowerCase().includes(q)).slice(0, 8);
  }, [query, base.nodes]);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    focusNonce.current += 1;
    setFocusReq({ id, nonce: focusNonce.current }); // triggers GraphCanvas zoom+select
    setQuery('');
  }, []);

  const toggleRelType = useCallback((tp: string) => {
    const cur = settings.hiddenRelationTypes;
    patch({ hiddenRelationTypes: cur.includes(tp) ? cur.filter((x) => x !== tp) : [...cur, tp] });
  }, [settings.hiddenRelationTypes, patch]);
  const setHiddenAll = useCallback((hidden: string[]) => patch({ hiddenRelationTypes: hidden }), [patch]);

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
          mode: layoutMode,
          clusterStrength: GALAXY_CLUSTER_STRENGTH,
          chargeStrength: GALAXY_CHARGE_STRENGTH,
          linkDistance: GALAXY_LINK_DISTANCE,
          spreadScale: layoutMode === 'ring' ? ringSpread : undefined,
        }}
        glowEnabled={egoFocusId ? true : settings.glow}
        edgesHidden={egoFocusId ? false : !settings.showAllEdges}
        alwaysShowChips={!!egoFocusId}
        alwaysShowLabels={!!egoFocusId}
        edgeRevealDepth={1}
        relationForm={settings.relationForm}
        mentionForm={settings.mentionForm}
        focusRequest={focusReq}
        onNavigate={setSelectedId}
      />

      {!egoFocusId && (
        <div style={{ position: 'absolute', top: 12, left: 12, width: 260, zIndex: 6 }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('graphSearchPlaceholder', 'Suchen…')}
            aria-label={t('graphSearch', 'Suche')}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '6px 10px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(20,24,30,0.9)', color: '#e8eef5',
            }}
          />
          {suggestions.length > 0 && (
            <div style={{
              marginTop: 4, background: 'rgba(20,24,30,0.96)', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.12)', overflow: 'hidden',
            }}>
              {suggestions.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNode(n.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', cursor: 'pointer',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#e8eef5', fontSize: 13,
                  }}
                >{n.label} <span style={{ opacity: 0.5, fontSize: 11 }}>· {n.type}</span></button>
              ))}
            </div>
          )}
        </div>
      )}

      {!egoFocusId && (
        <GraphFilterPanel
          types={relationTypes}
          hidden={settings.hiddenRelationTypes}
          onToggle={toggleRelType}
          onSetAll={setHiddenAll}
        />
      )}

      {!egoFocusId && (
        <div role="group" aria-label={t('graphLayout', 'Layout')} style={{
          position: 'absolute', top: 12, right: 12, zIndex: 7, display: 'flex', gap: 4,
          padding: 3, borderRadius: 8, background: 'rgba(20,24,30,0.9)', border: '1px solid rgba(255,255,255,0.15)',
        }}>
          {(['galaxy', 'ring'] as const).map((m) => (
            <button
              key={m}
              onClick={() => patch({ layoutMode: m })}
              aria-pressed={layoutMode === m}
              style={{
                padding: '5px 12px', borderRadius: 6, cursor: 'pointer', color: '#e8eef5', fontSize: 13,
                border: '1px solid rgba(255,255,255,0.12)',
                background: layoutMode === m ? '#3a6ea5' : 'transparent',
              }}
            >{m === 'galaxy' ? t('graphLayoutGalaxy', 'Galaxy') : t('graphLayoutDisc', 'Disc')}</button>
          ))}
        </div>
      )}

      {selectedId && (
        <div style={{
          position: 'absolute', top: 56, right: 12, width: 360, maxHeight: 'calc(100% - 68px)',
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
