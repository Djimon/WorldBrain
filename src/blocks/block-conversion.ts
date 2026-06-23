import type { Block } from './block-registry';

type TipTapTextNode = { type: 'text'; text: string };
type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};
export type TipTapDoc = { type: 'doc'; content: TipTapNode[] };

function extractText(content: TipTapNode[] | undefined): string {
  if (!content) return '';
  return content
    .flatMap((node) => {
      if (node.type === 'text') return [(node as unknown as TipTapTextNode).text];
      return [extractText(node.content)];
    })
    .join('');
}

function extractListItems(content: TipTapNode[] | undefined): string[] {
  if (!content) return [];
  return content.map((listItem) => extractText(listItem.content));
}

export function blocksToTipTap(blocks: Block[]): TipTapDoc {
  return {
    type: 'doc',
    content: blocks.map((block) => {
      switch (block.type) {
        case 'paragraph':
          return {
            type: 'paragraph',
            content: block.text ? [{ type: 'text', text: block.text }] : [],
          };

        case 'heading':
          return {
            type: 'heading',
            attrs: { level: block.level },
            content: block.text ? [{ type: 'text', text: block.text }] : [],
          };

        case 'list': {
          const nodeType = block.ordered ? 'orderedList' : 'bulletList';
          return {
            type: nodeType,
            content: block.items.map((item) => ({
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: item }] }],
            })),
          };
        }

        case 'entity_embed':
          return {
            type: 'entity_embed',
            attrs: { entityId: block.entityId, entityType: block.entityType },
          };

        case 'secret_block':
          return {
            type: 'secret_block',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: block.content }] }],
          };

        case 'rule_reference':
          return {
            type: 'rule_reference',
            attrs: { ruleId: block.ruleId, title: block.title },
          };
      }
    }),
  };
}

export function tipTapToBlocks(doc: TipTapDoc): Block[] {
  return (doc.content ?? []).flatMap((node): Block[] => {
    switch (node.type) {
      case 'paragraph':
        return [{ type: 'paragraph', text: extractText(node.content) }];

      case 'heading':
        return [{ type: 'heading', level: (node.attrs?.level ?? 1) as 1 | 2 | 3, text: extractText(node.content) }];

      case 'bulletList':
        return [{ type: 'list', ordered: false, items: extractListItems(node.content) }];

      case 'orderedList':
        return [{ type: 'list', ordered: true, items: extractListItems(node.content) }];

      case 'entity_embed':
        return [{ type: 'entity_embed', entityId: String(node.attrs?.entityId ?? ''), entityType: String(node.attrs?.entityType ?? '') }];

      case 'secret_block':
        return [{ type: 'secret_block', content: extractText(node.content) }];

      case 'rule_reference':
        return [{ type: 'rule_reference', ruleId: String(node.attrs?.ruleId ?? ''), title: String(node.attrs?.title ?? '') }];

      default:
        return [];
    }
  });
}
