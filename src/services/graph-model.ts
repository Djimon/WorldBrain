// M16-S02 (#317): Graph-Datenmodell — Entities + Relations + Mention-Kanten
// zu EINEM Graph-Modell in renderer-neutraler {nodes, links}-Form. Reine
// Funktion: kein DB-Zugriff, kein Rendering, kein Layout (die kommen in
// S03/S04/S05). d3-force + GraphCanvas/Pixi erwarten `links`, nicht `edges`.
export interface GraphEntityInput {
  id: string;
  type: string;
  title: string;
}

export interface GraphLinkInput {
  source: string;
  target: string;
}

export interface GraphNode {
  id: string;
  type: string;
  label: string;
  degree: number;
}

export interface GraphLink {
  source: string;
  target: string;
  kind: 'relation' | 'mention';
}

export interface GraphModel {
  nodes: GraphNode[];
  links: GraphLink[];
}

// D9 Subsumption: for an unordered (source,target) pair, a relation link
// always wins — every mention link for the same pair is dropped. Dedup:
// at most one link per (source, target, kind). Drop: links to/from ids not
// present in `entities` (dangling), and self-links (source === target).
// degree: count of remaining links (post subsumption/dedup/drop) touching
// the node — undirected.
export function buildGraphModel(
  _entities: GraphEntityInput[],
  _relationLinks: GraphLinkInput[],
  _mentionLinks: GraphLinkInput[],
): GraphModel {
  throw new Error('not implemented');
}
