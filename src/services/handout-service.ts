import type { DatabaseLike } from './entity-service';

export interface HandoutRow {
  id: string;
  type: string;
  title: string;
  source_entity_id?: string | null;
  audience: string;
  content_json: string;
  created_at?: string;
}

export function createHandout(
  db: DatabaseLike,
  opts: { type: string; title: string; audience: string; content: Record<string, unknown>; sourceEntityId?: string },
): { id: string } {
  const id = `handout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  db.prepare(
    `INSERT INTO handouts (id, type, title, source_entity_id, audience, content_json) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, opts.type, opts.title, opts.sourceEntityId ?? null, opts.audience, JSON.stringify(opts.content));
  return { id };
}

export function listHandouts(db: DatabaseLike, filter?: { type?: string; audience?: string }): HandoutRow[] {
  if (filter?.type) {
    return db.prepare('SELECT * FROM handouts WHERE type = ?').all(filter.type) as unknown as HandoutRow[];
  }
  return db.prepare('SELECT * FROM handouts').all() as unknown as HandoutRow[];
}

interface HandoutBlock {
  type: string;
  text?: string;
  visibility?: string;
}

interface GenerateHandoutHtmlOpts {
  handout: { type: string; title: string; audience: string; content: Record<string, unknown> };
  blocks: HandoutBlock[];
  context: { role: 'gm' | 'player'; knownEntities: string[]; sessionVars: Record<string, unknown>; globalVars: Record<string, unknown> };
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateHandoutHtml(opts: GenerateHandoutHtmlOpts): string {
  const { handout, blocks, context } = opts;
  const isPlayer = context.role === 'player';

  const bodyHtml = blocks
    .filter((b) => {
      if (b.visibility === 'gm_only' && isPlayer) return false;
      if (b.visibility === 'hidden_until_condition' && isPlayer) return false;
      if (b.visibility === 'player_known' && isPlayer) return false;
      return true;
    })
    .map((b) => `<p>${escHtml(b.text ?? '')}</p>`)
    .join('\n');

  const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`;
  return `<!DOCTYPE html><html><head>${csp}<title>${escHtml(handout.title)}</title></head><body>${bodyHtml}</body></html>`;
}
