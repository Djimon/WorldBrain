export interface ExportBlock {
  type: string;
  text?: string;
  visibility?: string;
  [key: string]: unknown;
}

export interface ExportEntity {
  id: string;
  title: string;
  summary?: string;
  visibility: string;
  body?: { format: string; blocks: ExportBlock[] };
  [key: string]: unknown;
}

export interface ExportContext {
  audience: 'gm' | 'player';
  vars?: Record<string, unknown>;
  globals?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  knownEntities?: Set<string>;
}

function isVisible(visibility: string, audience: 'gm' | 'player'): boolean {
  if (visibility === 'public') return true;
  if (visibility === 'gm_only') return audience === 'gm';
  return true;
}

export function generatePlayerViewHtml(params: {
  entities: ExportEntity[];
  context: ExportContext;
  selectedEntityIds: string[];
}): string {
  const { entities, context, selectedEntityIds } = params;
  const audience = context.audience;

  const selected = entities.filter((e) => selectedEntityIds.includes(e.id));
  const filtered = selected.filter((e) => isVisible(e.visibility, audience));

  const entityHtml = filtered.map((e) => {
    const blocks = e.body?.blocks ?? [];
    const visibleBlocks = blocks.filter((b) => isVisible(b.visibility ?? 'public', audience));
    const bodyHtml = visibleBlocks.map((b) => `<p>${b.text ?? ''}</p>`).join('');
    return `<section><h2>${e.title}</h2>${bodyHtml}</section>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Player View</title><style>body{font-family:sans-serif;max-width:800px;margin:auto;padding:1rem}</style></head>
<body>${entityHtml}</body>
</html>`;
}
