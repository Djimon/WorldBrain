import type { Block } from '../blocks/block-registry';

interface Entity {
  id: string;
  type: string;
  title: string;
  summary?: string;
  aliases?: string[];
  properties?: Record<string, unknown>;
  body?: { format: string; blocks: Block[] };
  visibility?: string;
  created_at?: string;
  updated_at?: string;
}

interface Props {
  entity: Entity;
  onEditToggle: () => void;
  onBack?: () => void;
}

function renderBlock(block: Block, i: number): React.ReactNode {
  if (block.type === 'heading') {
    const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
    return <Tag key={i}>{block.text}</Tag>;
  }
  if (block.type === 'paragraph') return <p key={i}>{block.text}</p>;
  if (block.type === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return <Tag key={i}>{block.items.map((item, j) => <li key={j}>{item}</li>)}</Tag>;
  }
  return null;
}

export function EntityReadingView({ entity, onEditToggle, onBack }: Props) {
  const blocks = entity.body?.blocks ?? [];

  return (
    <div>
      {onBack && (
        <button onClick={onBack} aria-label="Back">Back</button>
      )}
      <button onClick={onEditToggle}>Edit</button>
      {entity.summary && <p>{entity.summary}</p>}
      <article>
        {blocks.map((block, i) => renderBlock(block, i))}
      </article>
    </div>
  );
}
