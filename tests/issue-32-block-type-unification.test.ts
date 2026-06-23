// @vitest-environment node
// fix: Block type fragmentation between block-registry.ts and block-conversion.ts.
// block-conversion must import Block from block-registry, not re-declare its own.
// See: https://github.com/Djimon/WorldBrain/issues/32

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('issue-32 block type unification', () => {
  describe('source-level: no local Block re-declaration in block-conversion.ts', () => {
    it('block-conversion.ts does not declare its own Block type alias', () => {
      const src = readFileSync('src/blocks/block-conversion.ts', 'utf-8');
      // Must not have a local: type Block = Record<string, unknown>
      // or any other local Block type definition
      expect(src).not.toMatch(/^\s*type Block\s*=/m);
    });

    it('block-conversion.ts imports Block or PortableBlocksV1Doc from block-registry', () => {
      const src = readFileSync('src/blocks/block-conversion.ts', 'utf-8');
      expect(src).toMatch(/from\s+['"].*block-registry['"]/);
    });
  });

  describe('runtime: block-conversion accepts registry-typed blocks', () => {
    it('blocksToTipTap accepts a ParagraphBlock from block-registry', async () => {
      const { blocksToTipTap } = await import('../src/blocks/block-conversion');
      const block = { type: 'paragraph' as const, text: 'Hello world.' };

      const result = blocksToTipTap([block]);

      expect(result).toBeDefined();
      expect(result.type).toBe('doc');
    });

    it('blocksToTipTap accepts a HeadingBlock from block-registry', async () => {
      const { blocksToTipTap } = await import('../src/blocks/block-conversion');
      const block = { type: 'heading' as const, level: 2 as const, text: 'Chapter One' };

      const result = blocksToTipTap([block]);

      expect(result.type).toBe('doc');
    });

    it('blocksToTipTap accepts a ListBlock from block-registry', async () => {
      const { blocksToTipTap } = await import('../src/blocks/block-conversion');
      const block = {
        type: 'list' as const,
        style: 'bullet' as const,
        items: ['First', 'Second'],
      };

      const result = blocksToTipTap([block]);

      expect(result.type).toBe('doc');
    });

    it('blocksToTipTap accepts EntityEmbedBlock, SecretBlock, RuleReferenceBlock', async () => {
      const { blocksToTipTap } = await import('../src/blocks/block-conversion');
      const blocks = [
        { type: 'entity_embed' as const, entityId: 'x', entityType: 'Character' },
        { type: 'secret_block' as const, content: 'Shh.' },
        { type: 'rule_reference' as const, ruleId: 'r1', title: 'Rule 1' },
      ];

      expect(() => blocksToTipTap(blocks)).not.toThrow();
    });

    it('tipTapToBlocks returns typed Block array (not Record<string,unknown>)', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await import('../src/blocks/block-conversion');
      const input = [{ type: 'paragraph' as const, text: 'Test.' }];
      const tipTapDoc = blocksToTipTap(input);

      const result = tipTapToBlocks(tipTapDoc);

      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toHaveProperty('type', 'paragraph');
    });

    it('PortableBlocksV1Doc from block-registry is the type returned by conversion', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await import('../src/blocks/block-conversion');
      const { isPortableBlocksV1Doc } = await import('../src/blocks/block-registry');
      const input = [{ type: 'paragraph' as const, text: 'Test.' }];
      const tipTapDoc = blocksToTipTap(input);

      const blocks = tipTapToBlocks(tipTapDoc);
      const doc = { format: 'portable_blocks_v1' as const, blocks };

      expect(isPortableBlocksV1Doc(doc)).toBe(true);
    });
  });
});
