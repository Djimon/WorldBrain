export enum BlockType {
  paragraph = 'paragraph',
  heading = 'heading',
  list = 'list',
  entity_embed = 'entity_embed',
  secret_block = 'secret_block',
  rule_reference = 'rule_reference',
  map_embed = 'map_embed',
}

export type ParagraphBlock = { type: 'paragraph'; text: string };
export type HeadingBlock = { type: 'heading'; level: 1 | 2 | 3; text: string };
export type ListBlock = { type: 'list'; ordered: boolean; items: string[] };
export type EntityEmbedBlock = { type: 'entity_embed'; entityId: string; entityType: string };
export type SecretBlock = { type: 'secret_block'; content: string };
export type RuleReferenceBlock = { type: 'rule_reference'; ruleId: string; title: string };
export type MapEmbedBlock = { type: 'map_embed'; mapId: string };

export type Block =
  | ParagraphBlock
  | HeadingBlock
  | ListBlock
  | EntityEmbedBlock
  | SecretBlock
  | RuleReferenceBlock
  | MapEmbedBlock;

export type PortableBlocksV1Doc = { format: 'portable_blocks_v1'; blocks: Block[] };

export function isPortableBlocksV1Doc(value: unknown): value is PortableBlocksV1Doc {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).format === 'portable_blocks_v1' &&
    Array.isArray((value as Record<string, unknown>).blocks)
  );
}

type BlockDefinition = { type: BlockType; renderer?: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isParagraphBlock(value: unknown): value is ParagraphBlock {
  return isObject(value) && value.type === 'paragraph';
}

export function isHeadingBlock(value: unknown): value is HeadingBlock {
  return isObject(value) && value.type === 'heading' && (value.level === 1 || value.level === 2 || value.level === 3);
}

export function isListBlock(value: unknown): value is ListBlock {
  return isObject(value) && value.type === 'list' && Array.isArray(value.items);
}

export function isEntityEmbedBlock(value: unknown): value is EntityEmbedBlock {
  return isObject(value) && value.type === 'entity_embed';
}

export function isSecretBlock(value: unknown): value is SecretBlock {
  return isObject(value) && value.type === 'secret_block';
}

export function isRuleReferenceBlock(value: unknown): value is RuleReferenceBlock {
  return isObject(value) && value.type === 'rule_reference';
}

export function isMapEmbedBlock(value: unknown): value is MapEmbedBlock {
  return isObject(value) && value.type === 'map_embed';
}

const registry: Map<string, BlockDefinition> = new Map([
  [BlockType.paragraph, { type: BlockType.paragraph }],
  [BlockType.heading, { type: BlockType.heading }],
  [BlockType.list, { type: BlockType.list }],
  [BlockType.entity_embed, { type: BlockType.entity_embed }],
  [BlockType.secret_block, { type: BlockType.secret_block }],
  [BlockType.rule_reference, { type: BlockType.rule_reference }],
  [BlockType.map_embed, { type: BlockType.map_embed, renderer: 'MapEmbedBlock' }],
]);

export function getBlockDefinition(type: BlockType): BlockDefinition | undefined {
  return registry.get(type);
}

export function getBlockRegistry(): Array<{ type: string }> {
  return [...registry.values()];
}
