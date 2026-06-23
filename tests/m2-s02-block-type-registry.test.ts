// @vitest-environment node
// M2-S02: Block type registry for portable_blocks_v1.
// Tests enum completeness, type guards, JSON round-trip, registry lookup.
// See: https://github.com/Djimon/WorldBrain/issues/23

import { describe, expect, it } from 'vitest';

async function getBlockRegistry() {
  const module = await import('../src/blocks/block-registry');
  return module;
}

describe('M2-S02 block type registry', () => {
  describe('BlockType enum', () => {
    it('contains all six required block types', async () => {
      const { BlockType } = await getBlockRegistry();

      expect(Object.values(BlockType)).toContain('paragraph');
      expect(Object.values(BlockType)).toContain('heading');
      expect(Object.values(BlockType)).toContain('list');
      expect(Object.values(BlockType)).toContain('entity_embed');
      expect(Object.values(BlockType)).toContain('secret_block');
      expect(Object.values(BlockType)).toContain('rule_reference');
    });
  });

  describe('type guards', () => {
    it('isParagraphBlock returns true for a valid paragraph block', async () => {
      const { isParagraphBlock } = await getBlockRegistry();
      const block = { type: 'paragraph', text: 'Hello world.' };

      expect(isParagraphBlock(block)).toBe(true);
    });

    it('isParagraphBlock returns false for a non-paragraph block', async () => {
      const { isParagraphBlock } = await getBlockRegistry();

      expect(isParagraphBlock({ type: 'heading', level: 1, text: 'Title' })).toBe(false);
      expect(isParagraphBlock(null)).toBe(false);
      expect(isParagraphBlock({})).toBe(false);
    });

    it('isHeadingBlock returns true for a valid heading block', async () => {
      const { isHeadingBlock } = await getBlockRegistry();
      const block = { type: 'heading', level: 2, text: 'Chapter Two' };

      expect(isHeadingBlock(block)).toBe(true);
    });

    it('isHeadingBlock returns false for invalid heading level', async () => {
      const { isHeadingBlock } = await getBlockRegistry();

      expect(isHeadingBlock({ type: 'heading', level: 5, text: 'Too deep' })).toBe(false);
    });

    it('isListBlock returns true for bullet and ordered list blocks', async () => {
      const { isListBlock } = await getBlockRegistry();

      expect(isListBlock({ type: 'list', ordered: false, items: ['a', 'b'] })).toBe(true);
      expect(isListBlock({ type: 'list', ordered: true, items: ['first'] })).toBe(true);
    });

    it('isEntityEmbedBlock returns true for a valid entity_embed block', async () => {
      const { isEntityEmbedBlock } = await getBlockRegistry();
      const block = { type: 'entity_embed', entityId: 'character-ada', entityType: 'Character' };

      expect(isEntityEmbedBlock(block)).toBe(true);
    });

    it('isSecretBlock returns true for a valid secret_block', async () => {
      const { isSecretBlock } = await getBlockRegistry();
      const block = { type: 'secret_block', content: 'The villain is the mayor.' };

      expect(isSecretBlock(block)).toBe(true);
    });

    it('isRuleReferenceBlock returns true for a valid rule_reference block', async () => {
      const { isRuleReferenceBlock } = await getBlockRegistry();
      const block = { type: 'rule_reference', ruleId: 'rule-stealth', title: 'Stealth Check' };

      expect(isRuleReferenceBlock(block)).toBe(true);
    });
  });

  describe('JSON round-trip serialization', () => {
    it('paragraph block survives JSON serialize + deserialize', async () => {
      const { isParagraphBlock } = await getBlockRegistry();
      const block = { type: 'paragraph', text: 'Some narrative text.' };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isParagraphBlock(roundTripped)).toBe(true);
      expect(roundTripped.text).toBe(block.text);
    });

    it('heading block survives JSON serialize + deserialize', async () => {
      const { isHeadingBlock } = await getBlockRegistry();
      const block = { type: 'heading', level: 1, text: 'Act One' };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isHeadingBlock(roundTripped)).toBe(true);
      expect(roundTripped.level).toBe(1);
    });

    it('list block survives JSON serialize + deserialize', async () => {
      const { isListBlock } = await getBlockRegistry();
      const block = { type: 'list', ordered: false, items: ['First', 'Second'] };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isListBlock(roundTripped)).toBe(true);
      expect(roundTripped.items).toEqual(['First', 'Second']);
    });

    it('entity_embed block survives JSON serialize + deserialize', async () => {
      const { isEntityEmbedBlock } = await getBlockRegistry();
      const block = { type: 'entity_embed', entityId: 'location-keep', entityType: 'Location' };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isEntityEmbedBlock(roundTripped)).toBe(true);
      expect(roundTripped.entityId).toBe('location-keep');
    });

    it('secret_block survives JSON serialize + deserialize', async () => {
      const { isSecretBlock } = await getBlockRegistry();
      const block = { type: 'secret_block', content: 'Hidden lore.' };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isSecretBlock(roundTripped)).toBe(true);
    });

    it('rule_reference block survives JSON serialize + deserialize', async () => {
      const { isRuleReferenceBlock } = await getBlockRegistry();
      const block = { type: 'rule_reference', ruleId: 'rule-grapple', title: 'Grapple' };

      const roundTripped = JSON.parse(JSON.stringify(block));

      expect(isRuleReferenceBlock(roundTripped)).toBe(true);
    });
  });

  describe('registry lookup', () => {
    it('getBlockDefinition returns a definition for each registered block type', async () => {
      const { getBlockDefinition, BlockType } = await getBlockRegistry();

      for (const blockType of Object.values(BlockType)) {
        const def = getBlockDefinition(blockType);
        expect(def).toBeDefined();
        expect(def.type).toBe(blockType);
      }
    });

    it('getBlockDefinition returns undefined for an unknown block type', async () => {
      const { getBlockDefinition } = await getBlockRegistry();

      expect(getBlockDefinition('unknown_block' as never)).toBeUndefined();
    });
  });

  describe('portable_blocks_v1 document', () => {
    it('a portable_blocks_v1 document is an array of block union types', async () => {
      const { isParagraphBlock, isHeadingBlock } = await getBlockRegistry();
      const doc = {
        format: 'portable_blocks_v1',
        blocks: [
          { type: 'heading', level: 1, text: 'Intro' },
          { type: 'paragraph', text: 'Once upon a time.' },
        ],
      };

      expect(doc.format).toBe('portable_blocks_v1');
      expect(Array.isArray(doc.blocks)).toBe(true);
      expect(isHeadingBlock(doc.blocks[0])).toBe(true);
      expect(isParagraphBlock(doc.blocks[1])).toBe(true);
    });
  });
});
