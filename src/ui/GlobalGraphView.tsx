// M16-S03 (#324): loads ALL entities + relations + mention edges, builds the
// full GraphModel (S02 #317), and hands the COMPLETE model to GraphCanvas —
// the single shared renderer core (D12). Ego (S07 #321) will hand the same
// GraphCanvas only { focus + N neighbors } — no separate renderer.
//
// Implementation contract: listEntitiesByType (or an all-entities listing)
// + getAllRelations(db) (relation-service.ts) + buildMentionEdges(entities)
// (mention-graph.ts, S01 #288) -> buildGraphModel(...) (graph-model.ts, S02
// #317) -> { nodes, links }. degree + D9 subsumption come from S02, not
// rebuilt here.
import type { DatabaseLike } from '../services/entity-service';

export interface GlobalGraphViewProps {
  database: DatabaseLike;
  onNavigate: (id: string) => void;
}

export function GlobalGraphView(_props: GlobalGraphViewProps): React.ReactElement {
  throw new Error('not implemented');
}

export default GlobalGraphView;
