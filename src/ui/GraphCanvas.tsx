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
  // S04 (#318): additive cluster-by-type force strength (galaxy only).
  clusterStrength?: number;
  // d3-force charge (repulsion). Default in canvas: -200 (good visual spread).
  // The galaxy-layout service default (-60) is kept for backward-compat tests.
  chargeStrength?: number;
  // d3-force link spring rest length. Canvas default: 80.
  linkDistance?: number;
  // Visual spread multiplier applied AFTER position normalization — >1 zooms
  // in (nodes spread out, some may clip), <1 zooms out (more whitespace).
  spreadScale?: number;
}

export interface GraphCanvasProps {
  nodes: GraphNode[];
  links: GraphLink[];
  nodeStyle: (node: GraphNode) => NodeVisualStyle;
  edgeStyle: (link: GraphLink) => EdgeVisualStyle;
  layout?: GraphLayoutConfig;
  // D2: per-node glow halo — OFF by default; on/off via S06 (#319).
  glowEnabled?: boolean;
  // Uniform multiplier on node radius (0.5 = half size, 2.0 = double). Default 1.
  nodeSizeScale?: number;
  onNavigate: (id: string) => void;
  onHoverNode?: (id: string | null) => void;
}

const DEFAULT_GALAXY_CLUSTER_STRENGTH = 0.3;
// Better visual defaults for GraphCanvas — do NOT change galaxy-layout.ts
// defaults (those are pinned by the S04 tests).
const DEFAULT_CHARGE_STRENGTH = -200;
const DEFAULT_LINK_DISTANCE = 80;
const CANVAS_PADDING = 60;
const HALO_RADIUS_FACTOR = 1.8;
const HALO_ALPHA = 0.35;
const DIM_ALPHA = 0.25;
const FALLBACK_WIDTH = 800;
const FALLBACK_HEIGHT = 600;

// D2: pseudo-3D sphere (Radial-Gradient-Approximation via layered circles).
// Base circle in node color + top-left highlight + bright core = "shiny ball"
// look without a real radial gradient (PixiJS v8 Graphics has no native
// radial gradient; layered-circle approach is the PixiJS-idiomatic way).
function drawSphere(g: Graphics, radius: number, color: number): void {
  g.circle(0, 0, radius).fill(color);
  g.circle(-radius * 0.28, -radius * 0.30, radius * 0.45).fill(0xffffff, 0.45);
  g.circle(-radius * 0.33, -radius * 0.36, radius * 0.18).fill(0xffffff, 0.80);
}

export function GraphCanvas({
  nodes, links, nodeStyle, edgeStyle, layout, glowEnabled, nodeSizeScale, onNavigate, onHoverNode,
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

    const clusterStrength = layout?.mode === 'galaxy'
      ? (layout.clusterStrength ?? DEFAULT_GALAXY_CLUSTER_STRENGTH)
      : 0;
    const chargeStrength = layout?.chargeStrength ?? DEFAULT_CHARGE_STRENGTH;
    const linkDistance = layout?.linkDistance ?? DEFAULT_LINK_DISTANCE;
    const spreadScale = layout?.spreadScale ?? 1.0;
    const sizeScale = nodeSizeScale ?? 1.0;

    const positioned = computeGalaxyLayout(nodes, links, {
      clusterStrength,
      chargeStrength,
      linkDistance,
    });

    // Normalize physics positions so the graph fills the canvas evenly,
    // independent of the raw force-sim coordinate scale.
    let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
    for (const p of positioned) {
      if (p.x < xMin) xMin = p.x;
      if (p.x > xMax) xMax = p.x;
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }
    const xRange = xMax - xMin || 1;
    const yRange = yMax - yMin || 1;
    const normScale =
      Math.min((width - 2 * CANVAS_PADDING) / xRange, (height - 2 * CANVAS_PADDING) / yRange) *
      spreadScale;
    const dataCx = (xMin + xMax) / 2;
    const dataCy = (yMin + yMax) / 2;

    // Screen coordinates for each node (center of canvas = (width/2, height/2)).
    const screenById = new Map(
      positioned.map((n) => [
        n.id,
        {
          sx: (n.x - dataCx) * normScale + width / 2,
          sy: (n.y - dataCy) * normScale + height / 2,
        },
      ]),
    );

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
        const screen = screenById.get(node.id);
        if (!screen) continue;
        const style = nodeStyle(node);
        const radius = style.radius * sizeScale;

        // D2: per-node glow halo — soft additive circle behind the sphere.
        if (glowEnabled) {
          const halo = new Graphics();
          halo.circle(0, 0, radius * HALO_RADIUS_FACTOR).fill(style.color, HALO_ALPHA);
          halo.x = screen.sx;
          halo.y = screen.sy;
          app.stage.addChild(halo);
        }

        const g = new Graphics();

        // D5: bundled edge rendering — edges drawn onto the node's own
        // Graphics object (relative coords from node center to target).
        for (const link of links) {
          if (link.source !== node.id) continue;
          const target = screenById.get(link.target);
          if (!target) continue;
          const edge = edgeStyle(link);
          g.moveTo(0, 0)
            .lineTo(target.sx - screen.sx, target.sy - screen.sy)
            .stroke({ width: edge.width, color: edge.color, alpha: edge.alpha });
        }

        // D2: pseudo-3D sphere (base + highlight + bright core).
        drawSphere(g, radius, style.color);

        g.x = screen.sx;
        g.y = screen.sy;
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
  }, [
    nodes, links,
    layout?.mode, layout?.clusterStrength, layout?.chargeStrength,
    layout?.linkDistance, layout?.spreadScale,
    glowEnabled, nodeSizeScale,
  ]);

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />;
}

export default GraphCanvas;
