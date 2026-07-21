// M15-S17: Mention-Kanten-Extraktion (#288)
// Pure function — no DB access, caller passes entities in.

export interface MentionEdge {
  source: string;
  target: string;
}

export interface EntityForMentionGraph {
  id: string;
  summary?: string | null;
  properties_json?: string | null;
  body_json?: string | null;
}

export function buildMentionEdges(_entities: EntityForMentionGraph[]): MentionEdge[] {
  throw new Error('not implemented');
}
