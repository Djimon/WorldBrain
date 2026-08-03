// M16-S03 (#324): the ONE renderer core for every graph view (D12, hard
// requirement) — global force graph (this story), Galaxy (S04 #318), Ring
// (S05 #290), Ego (S07 #321) are all THIS component with a different
// `layout` config and a different `{nodes, links}` slice. No graph "kind"
// hardcoded here (no global-vs-ego branching); the caller decides what to
// render, this component only draws it.
//
// Implementation contract (Pixi v8, WebGL — not WebGPU):
//   const app = new Application();
//   await app.init({ width, height, backgroundAlpha: 0, antialias: true });
//   mountEl.appendChild(app.canvas);
//   // one bundled Graphics/Mesh batch for ALL edges (never one display
//   // object per line — Pixi's weak point at 3-5x nodes edge count).
//   // one Container (or Sprite) per node, eventMode='static',
//   // .on('pointerdown', () => onNavigate(node.id))
//   // .on('pointerover'/'pointerout', ...) for hover-highlight.
//   // d3-force pre-computed and stopped (alpha decays to 0) per D10 — never
//   // simulated live once the layout has settled.
//   // on unmount: app.destroy({ removeView: true }).
import { useEffect, useRef } from 'react';
import { Application, Graphics } from 'pixi.js';
import type { GraphLink, GraphNode } from '../services/graph-model';
import type { EdgeVisualStyle, NodeVisualStyle } from '../services/graph-style';
import { computeGalaxyLayout } from '../services/galaxy-layout';

export interface GraphLayoutConfig {
  mode: 'force' | 'galaxy' | 'ring';
  // S04 (#318): additive cluster-by-type force strength, only used when
  // mode === 'galaxy'. S05 (#290): mode === 'ring' fixes fx/fy, force off.
  clusterStrength?: number;
}

export interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeStyle: (node: GraphNode) => NodeVisualStyle;
  edgeStyle: (link: GraphLink) => EdgeVisualStyle;
  layout?: GraphLayoutConfig;
  // D2: per-node glow halo — implemented but OFF by default in this story;
  // the on/off switch is S06 (#319).
  glowEnabled?: boolean;
  onNavigate: (id: string) => void;
  onHoverNode?: (id: string | null) => void;
}

const DEFAULT_GALAXY_CLUSTER_STRENGTH = 0.3;
const HALO_RADIUS_FACTOR = 1.8;
const HALO_ALPHA = 0.35;
const DIM_ALPHA = 0.25;
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 600;

export function GraphCanvas({
  nodes, links, nodeStyle, edgeStyle, layout, glowEnabled, onNavigate, onHoverNode,
}: GraphCanvasProps): React.ReactElement {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mountEl = mountRef.current;
    if (!mountEl) return;

    let destroyed = false;
    let appReady = false;
    const app = new Application();
    const width = mountEl.clientWidth || FALLBACK_WIDTH;
    const height = mountEl.clientHeight || FALLBACK_HEIGHT;

    // D8/D12: same GraphCanvas for force (default) and Galaxy (S04) — only
    // the cluster strength fed into the shared d3-force layout differs.
    // Ring (S05, needs-design) is out of scope; falls back to force here.
    const clusterStrength = layout?.mode === 'galaxy'
      ? (layout.clusterStrength ?? DEFAULT_GALAXY_CLUSTER_STRENGTH)
      : 0;
    const positioned = computeGalaxyLayout(nodes, links, { clusterStrength });
    const posById = new Map(positioned.map((n) => [n.id, n]));

    const neighbors = new Map<string, Set<string>>();
    for (const l of links) {
      if (!neighbors.has(l.source)) neighbors.set(l.source, new Set());
      if (!neighbors.has(l.target)) neighbors.set(l.target, new Set());
      neighbors.get(l.source)!.add(l.target);
      neighbors.get(l.target)!.add(l.source);
    }

    const nodeGraphicsById = new Map<string, Graphics>();

    function dimForHover(hoveredId: string) {
      const keep = neighbors.get(hoveredId) ?? new Set<string>();
      for (const [id, gfx] of nodeGraphicsById) {
        gfx.alpha = (id === hoveredId || keep.has(id)) ? 1 : DIM_ALPHA;
      }
    }
    function clearHoverDim() {
      for (const gfx of nodeGraphicsById.values()) gfx.alpha = 1;
    }

    void app.init({ width, height, backgroundAlpha: 0, antialias: true }).then(() => {
      if (destroyed) { app.destroy({ removeView: true }, true); return; }
      appReady = true;
      mountEl.appendChild(app.canvas);

      for (const node of nodes) {
        const pos = posById.get(node.id);
        if (!pos) continue;
        const style = nodeStyle(node);

        // D2: per-node glow halo — off by default (glowEnabled), on/off
        // switch itself is S06. Drawn as its own soft additive sprite behind
        // the node, never a full-screen bloom.
        if (glowEnabled) {
          const halo = new Graphics();
          halo.circle(0, 0, style.radius * HALO_RADIUS_FACTOR).fill(style.color, HALO_ALPHA);
          halo.x = pos.x + width / 2;
          halo.y = pos.y + height / 2;
          app.stage.addChild(halo);
        }

        const g = new Graphics();

        // D5: bundled edge rendering — this node's outgoing links are drawn
        // onto its OWN Graphics instead of a dedicated per-line display
        // object, so edge count never adds extra draw-call objects per link.
        for (const link of links) {
          if (link.source !== node.id) continue;
          const target = posById.get(link.target);
          if (!target) continue;
          const edge = edgeStyle(link);
          g.moveTo(0, 0)
            .lineTo(target.x - pos.x, target.y - pos.y)
            .stroke({ width: edge.width, color: edge.color, alpha: edge.alpha });
        }

        g.circle(0, 0, style.radius).fill(style.color);
        g.x = pos.x + width / 2;
        g.y = pos.y + height / 2;
        g.eventMode = 'static';
        g.cursor = 'pointer';
        g.on('pointerdown', () => onNavigate(node.id));
        g.on('pointerover', () => { onHoverNode?.(node.id); dimForHover(node.id); });
        g.on('pointerout', () => { onHoverNode?.(null); clearHoverDim(); });

        app.stage.addChild(g);
        nodeGraphicsById.set(node.id, g);
      }
    });

    return () => {
      destroyed = true;
      if (appReady) app.destroy({ removeView: true }, true);
      // if !appReady, init() is still pending — its .then() sees destroyed=true
      // and calls destroy() there (avoids destroy() before _cancelResize is set).
    };
    // Positions/handlers are fully recomputed from these inputs each mount —
    // an intentional full remount on any change, not a live-diffed update.
  }, [nodes, links, layout?.mode, layout?.clusterStrength, glowEnabled]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default GraphCanvas;
