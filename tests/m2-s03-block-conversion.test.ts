// @vitest-environment node
// M2-S03: portable_blocks_v1 ↔ TipTap JSON conversion functions.
// Tests the pure conversion layer — no TipTap/DOM dependency here.
// TipTap component integration is in m2-s03-body-editor.dom.test.tsx.
// See: https://github.com/Djimon/WorldBrain/issues/24

import { describe, expect, it } from 'vitest';

async function getBlockConversion() {
  const module = await import('../src/blocks/block-conversion');
  return module;
}

describe('M2-S03 block conversion: portable_blocks_v1 ↔ TipTap JSON', () => {
  describe('blocksToTipTap — portable_blocks_v1 → TipTap document', () => {
    it('converts a paragraph block to a TipTap paragraph node', async () => {
      const { blocksToTipTap } = await getBlockConversion();
      const blocks = [{ type: 'paragraph', text: 'Hello world.' }];

      const doc = blocksToTipTap(blocks);

      expect(doc.type).toBe('doc');
      expect(doc.content).toHaveLength(1);
      expect(doc.content[0].type).toBe('paragraph');
    });

    it('converts a heading block (H1) to a TipTap heading node with level attribute', async () => {
      const { blocksToTipTap } = await getBlockConversion();
      const blocks = [{ type: 'heading', level: 1, text: 'Act One' }];

      const doc = blocksToTipTap(blocks);

      expect(doc.content[0].type).toBe('heading');
      expect(doc.content[0].attrs?.level).toBe(1);
    });

    it('converts H2 and H3 heading blocks with correct level attributes', async () => {
      const { blocksToTipTap } = await getBlockConversion();

      const h2Doc = blocksToTipTap([{ type: 'heading', level: 2, text: 'Scene' }]);
      const h3Doc = blocksToTipTap([{ type: 'heading', level: 3, text: 'Beat' }]);

      expect(h2Doc.content[0].attrs?.level).toBe(2);
      expect(h3Doc.content[0].attrs?.level).toBe(3);
    });

    it('converts a bullet list block to a TipTap bulletList node', async () => {
      const { blocksToTipTap } = await getBlockConversion();
      const blocks = [{ type: 'list', ordered: false, items: ['Apple', 'Berry'] }];

      const doc = blocksToTipTap(blocks);

      expect(doc.content[0].type).toBe('bulletList');
    });

    it('converts an ordered list block to a TipTap orderedList node', async () => {
      const { blocksToTipTap } = await getBlockConversion();
      const blocks = [{ type: 'list', ordered: true, items: ['First', 'Second'] }];

      const doc = blocksToTipTap(blocks);

      expect(doc.content[0].type).toBe('orderedList');
    });

    it('converts a mixed document with multiple block types', async () => {
      const { blocksToTipTap } = await getBlockConversion();
      const blocks = [
        { type: 'heading', level: 1, text: 'Chapter' },
        { type: 'paragraph', text: 'Narrative.' },
        { type: 'list', ordered: false, items: ['Clue A', 'Clue B'] },
      ];

      const doc = blocksToTipTap(blocks);

      expect(doc.content).toHaveLength(3);
      expect(doc.content[0].type).toBe('heading');
      expect(doc.content[1].type).toBe('paragraph');
      expect(doc.content[2].type).toBe('bulletList');
    });

    it('returns an empty doc when blocks array is empty', async () => {
      const { blocksToTipTap } = await getBlockConversion();

      const doc = blocksToTipTap([]);

      expect(doc.type).toBe('doc');
      expect(doc.content).toEqual([]);
    });
  });

  describe('tipTapToBlocks — TipTap document → portable_blocks_v1', () => {
    it('converts a TipTap paragraph node back to a paragraph block', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const doc = {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world.' }] }],
      };

      const blocks = tipTapToBlocks(doc);

      expect(blocks).toHaveLength(1);
      expect(blocks[0].type).toBe('paragraph');
      expect((blocks[0] as { type: string; text: string }).text).toBe('Hello world.');
    });

    it('converts a TipTap heading node back to a heading block with correct level', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const doc = {
        type: 'doc',
        content: [{ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Scene' }] }],
      };

      const blocks = tipTapToBlocks(doc);

      expect(blocks[0].type).toBe('heading');
      expect((blocks[0] as { type: string; level: number }).level).toBe(2);
    });

    it('converts a TipTap bulletList back to a list block with ordered: false', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const doc = {
        type: 'doc',
        content: [{
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Apple' }] }] },
          ],
        }],
      };

      const blocks = tipTapToBlocks(doc);

      expect(blocks[0].type).toBe('list');
      expect((blocks[0] as { type: string; ordered: boolean }).ordered).toBe(false);
    });

    it('converts a TipTap orderedList back to a list block with ordered: true', async () => {
      const { tipTapToBlocks } = await getBlockConversion();
      const doc = {
        type: 'doc',
        content: [{
          type: 'orderedList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Step one' }] }] },
          ],
        }],
      };

      const blocks = tipTapToBlocks(doc);

      expect((blocks[0] as { type: string; ordered: boolean }).ordered).toBe(true);
    });

    it('returns empty array for an empty TipTap doc', async () => {
      const { tipTapToBlocks } = await getBlockConversion();

      const blocks = tipTapToBlocks({ type: 'doc', content: [] });

      expect(blocks).toEqual([]);
    });
  });

  describe('round-trip: blocks → TipTap → blocks', () => {
    it('paragraph survives round-trip without data loss', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'paragraph', text: 'Preserved text.' }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      expect(roundTripped[0].type).toBe('paragraph');
      expect((roundTripped[0] as { type: string; text: string }).text).toBe('Preserved text.');
    });

    it('heading survives round-trip with level intact', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'heading', level: 3, text: 'Subsection' }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      expect(roundTripped[0].type).toBe('heading');
      expect((roundTripped[0] as { type: string; level: number }).level).toBe(3);
    });

    it('list survives round-trip with items and ordered flag intact', async () => {
      const { blocksToTipTap, tipTapToBlocks } = await getBlockConversion();
      const original = [{ type: 'list', ordered: true, items: ['Step A', 'Step B'] }];

      const roundTripped = tipTapToBlocks(blocksToTipTap(original));

      expect(roundTripped[0].type).toBe('list');
      const list = roundTripped[0] as { type: string; ordered: boolean; items: string[] };
      expect(list.ordered).toBe(true);
      expect(list.items).toEqual(['Step A', 'Step B']);
    });
  });
});
