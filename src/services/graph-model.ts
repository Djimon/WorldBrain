// M16-S02 (#317): graph data model — entities + relations + mention edges
// into ONE graph model in renderer-neutral {nodes, links} form. Pure
// function: no DB access, no rendering, no layout (those come in
// S03/S04/S05). d3-force + GraphCanvas/Pixi expect `links`, not `edges`.
export interface GraphEntityInput {
  id: string;
  type: string;
  title: string;
}

export interface GraphLinkInput {
  source: string;
  target: string;
  relation_type?: string;
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
  // present for kind:'relation' (from getAllRelations) -> edge-type chips.
  relation_type?: string;
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
function pairKey(a: string, b: string): string {
  return a < b ? `${a} ${b}` : `${b} ${a}`;
}

export function buildGraphModel(
  entities: GraphEntityInput[],
  relationLinks: GraphLinkInput[],
  mentionLinks: GraphLinkInput[],
): GraphModel {
  const idSet = new Set(entities.map((e) => e.id));

  function toValidLinks(raw: GraphLinkInput[], kind: GraphLink['kind']): GraphLink[] {
    return raw
      .filter((l) => l.source !== l.target && idSet.has(l.source) && idSet.has(l.target))
      .map((l) => (kind === 'relation' && l.relation_type != null
        ? { source: l.source, target: l.target, kind, relation_type: l.relation_type }
        : { source: l.source, target: l.target, kind }));
  }

  // Dedup at most one link per (unordered pair, kind) — independent of the
  // order source/target were given in.
  function dedupe(links: GraphLink[]): GraphLink[] {
    const seen = new Set<string>();
    const out: GraphLink[] = [];
    for (const l of links) {
      const key = `${l.kind} ${pairKey(l.source, l.target)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(l);
    }
    return out;
  }

  const relationCandidates = toValidLinks(relationLinks, 'relation');
  const mentionCandidates = toValidLinks(mentionLinks, 'mention');

  // D9: a relation link subsumes every mention link for the same unordered pair.
  const relationPairs = new Set(relationCandidates.map((l) => pairKey(l.source, l.target)));
  const mentionSurvivors = mentionCandidates.filter((l) => !relationPairs.has(pairKey(l.source, l.target)));

  const links = [...dedupe(relationCandidates), ...dedupe(mentionSurvivors)];

  const degree = new Map<string, number>(entities.map((e) => [e.id, 0]));
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) ?? 0) + 1);
    degree.set(l.target, (degree.get(l.target) ?? 0) + 1);
  }

  const nodes: GraphNode[] = entities.map((e) => ({
    id: e.id,
    type: e.type,
    label: e.title,
    degree: degree.get(e.id) ?? 0,
  }));

  return { nodes, links };
}
