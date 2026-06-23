type TipTapTextNode = { type: 'text'; text: string };
type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
};
type TipTapDoc = { type: 'doc'; content: TipTapNode[] };

type Block = Record<string, unknown>;

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
            content: block.text ? [{ type: 'text', text: block.text as string }] : [],
          };

        case 'heading':
          return {
            type: 'heading',
            attrs: { level: block.level },
            content: block.text ? [{ type: 'text', text: block.text as string }] : [],
          };

        case 'list': {
          const nodeType = block.ordered ? 'orderedList' : 'bulletList';
          return {
            type: nodeType,
            content: (block.items as string[]).map((item) => ({
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
            content: [{ type: 'paragraph', content: [{ type: 'text', text: block.content as string }] }],
          };

        case 'rule_reference':
          return {
            type: 'rule_reference',
            attrs: { ruleId: block.ruleId, title: block.title },
          };

        default:
          return { type: 'paragraph', content: [] };
      }
    }),
  };
}

export function tipTapToBlocks(doc: TipTapDoc): Block[] {
  return (doc.content ?? []).flatMap((node) => {
    switch (node.type) {
      case 'paragraph':
        return [{ type: 'paragraph', text: extractText(node.content) }];

      case 'heading':
        return [{ type: 'heading', level: node.attrs?.level ?? 1, text: extractText(node.content) }];

      case 'bulletList':
        return [{ type: 'list', ordered: false, items: extractListItems(node.content) }];

      case 'orderedList':
        return [{ type: 'list', ordered: true, items: extractListItems(node.content) }];

      case 'entity_embed':
        return [{ type: 'entity_embed', entityId: node.attrs?.entityId ?? '', entityType: node.attrs?.entityType ?? '' }];

      case 'secret_block':
        return [{ type: 'secret_block', content: extractText(node.content) }];

      case 'rule_reference':
        return [{ type: 'rule_reference', ruleId: node.attrs?.ruleId ?? '', title: node.attrs?.title ?? '' }];

      default:
        return [];
    }
  });
}
