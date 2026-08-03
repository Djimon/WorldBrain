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
import type { GraphLink, GraphNode } from '../services/graph-model';
import type { EdgeVisualStyle, NodeVisualStyle } from '../services/graph-style';

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

export function GraphCanvas(_props: GraphCanvasProps): React.ReactElement {
  throw new Error('not implemented');
}

export default GraphCanvas;
