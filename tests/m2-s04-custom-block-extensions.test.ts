// @vitest-environment node
// M2-S04: Custom TipTap block extensions (entity_embed, secret_block, rule_reference).
// Tests serialization to portable_blocks_v1, fallback, and registry registration.
// See: https://github.com/Djimon/WorldBrain/issues/25

import { describe, expect, it } from 'vitest';

async function getBlockRegistry() {
  const module = await import('../src/blocks/block-registry');
  return module;
}

async function getBlockConversion() {
  const module = await import('../src/blocks/block-conversion');
  return module;
}

describe('M2-S04 custom block extensions', () => {
  describe('entity_embed', () => {
    it('is registered in the block registry', async () => {
      const { getBlockDefinition, BlockType } = await getBlockRegistry();

      const def = getBlockDefinition(BlockType.entity_embed);

      expect(def).toBeDefined();
      expect(def?.type).toBe('entity_embed');
    });

    it('serializes to portable_blocks_v1 with entityId and entityType', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const tipTapDoc = {
        type: 'doc',
        content: [{
          type: 'entity_embed',
          attrs: { entityId: 'character-ada', entityType: 'Character' },
        }],
      };

      const blocks = tipTapToBlocks(tipTapDoc);

      expect(blocks[0].type).toBe('entity_embed');
      const embed = blocks[0] as { type: string; entityId: string; entityType: string };
      expect(embed.entityId).toBe('character-ada');
      expect(embed.entityType).toBe('Character');
    });

    it('round-trips entity_embed block through TipTap format without data loss', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'entity_embed', entityId: 'location-keep', entityType: 'Location' }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      expect(roundTripped[0].type).toBe('entity_embed');
      const embed = roundTripped[0] as { type: string; entityId: string; entityType: string };
      expect(embed.entityId).toBe('location-keep');
      expect(embed.entityType).toBe('Location');
    });

    it('includes fallback data when entityId is missing', async () => {
      const { isEntityEmbedBlock } = await getBlockRegistry();
      const block = { type: 'entity_embed', entityId: '', entityType: 'Character' };

      expect(isEntityEmbedBlock(block)).toBe(true);
    });
  });

  describe('secret_block', () => {
    it('is registered in the block registry', async () => {
      const { getBlockDefinition, BlockType } = await getBlockRegistry();

      const def = getBlockDefinition(BlockType.secret_block);

      expect(def).toBeDefined();
      expect(def?.type).toBe('secret_block');
    });

    it('serializes to portable_blocks_v1 with content field', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const tipTapDoc = {
        type: 'doc',
        content: [{
          type: 'secret_block',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hidden villain reveal.' }] }],
        }],
      };

      const blocks = tipTapToBlocks(tipTapDoc);

      expect(blocks[0].type).toBe('secret_block');
      expect((blocks[0] as { type: string; content: string }).content).toBeTruthy();
    });

    it('round-trips secret_block without data loss', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'secret_block', content: 'The mayor is the villain.' }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      expect(roundTripped[0].type).toBe('secret_block');
      expect((roundTripped[0] as { type: string; content: string }).content).toBe('The mayor is the villain.');
    });
  });

  describe('rule_reference', () => {
    it('is registered in the block registry', async () => {
      const { getBlockDefinition, BlockType } = await getBlockRegistry();

      const def = getBlockDefinition(BlockType.rule_reference);

      expect(def).toBeDefined();
      expect(def?.type).toBe('rule_reference');
    });

    it('serializes to portable_blocks_v1 with ruleId and title', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const tipTapDoc = {
        type: 'doc',
        content: [{
          type: 'rule_reference',
          attrs: { ruleId: 'rule-stealth', title: 'Stealth Check' },
        }],
      };

      const blocks = tipTapToBlocks(tipTapDoc);

      expect(blocks[0].type).toBe('rule_reference');
      const ref = blocks[0] as { type: string; ruleId: string; title: string };
      expect(ref.ruleId).toBe('rule-stealth');
      expect(ref.title).toBe('Stealth Check');
    });

    it('round-trips rule_reference block without data loss', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'rule_reference', ruleId: 'rule-grapple', title: 'Grapple' }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      const ref = roundTripped[0] as { type: string; ruleId: string; title: string };
      expect(ref.ruleId).toBe('rule-grapple');
      expect(ref.title).toBe('Grapple');
    });
  });

  describe('all three custom block types survive portable_blocks_v1 JSON serialization', () => {
    it('a document with all three custom blocks serializes to valid JSON and back', async () => {
      const { isEntityEmbedBlock, isSecretBlock, isRuleReferenceBlock } = await getBlockRegistry();
      const blocks = [
        { type: 'entity_embed', entityId: 'character-ada', entityType: 'Character' },
        { type: 'secret_block', content: 'Secret.' },
        { type: 'rule_reference', ruleId: 'rule-stealth', title: 'Stealth Check' },
      ];

      const parsed = JSON.parse(JSON.stringify({ format: 'portable_blocks_v1', blocks }));

      expect(isEntityEmbedBlock(parsed.blocks[0])).toBe(true);
      expect(isSecretBlock(parsed.blocks[1])).toBe(true);
      expect(isRuleReferenceBlock(parsed.blocks[2])).toBe(true);
    });
  });
});
