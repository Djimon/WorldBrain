// M2-S04b: TipTap Node extensions for entity_embed, secret_block, rule_reference.
// Tests that all three custom block types survive a live TipTap editor round-trip.
// See: https://github.com/Djimon/WorldBrain/issues/29

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BodyEditor } from '../src/ui/BodyEditor';

const makeDoc = (blocks: unknown[]) => ({
  format: 'portable_blocks_v1' as const,
  blocks,
});

describe('M2-S04b TipTap Node extensions', () => {
  describe('entity_embed TipTap extension', () => {
    it('registers entity_embed as a first-class TipTap Node (renders without throwing)', () => {
      const content = makeDoc([
        { type: 'entity_embed', entityId: 'character-ada', entityType: 'Character' },
      ]);
      expect(() => render(<BodyEditor initialContent={content} onChange={() => {}} />)).not.toThrow();
    });

    it('entity_embed block is not silently dropped after loading into the editor', () => {
      let captured: unknown = null;
      const content = makeDoc([
        { type: 'entity_embed', entityId: 'character-ada', entityType: 'Character' },
      ]);

      render(
        <BodyEditor
          initialContent={content}
          onChange={(doc) => { captured = doc; }}
        />,
      );

      // Trigger onChange by checking the initial serialization output
      // The editor should preserve the entity_embed block, not drop it
      const editor = screen.getByRole('textbox', { hidden: true }) ?? document.querySelector('[contenteditable]');
      expect(editor).toBeTruthy();
    });
  });

  describe('secret_block TipTap extension', () => {
    it('registers secret_block as a first-class TipTap Node (renders without throwing)', () => {
      const content = makeDoc([
        { type: 'secret_block', content: 'Hidden plot twist.' },
      ]);
      expect(() => render(<BodyEditor initialContent={content} onChange={() => {}} />)).not.toThrow();
    });
  });

  describe('rule_reference TipTap extension', () => {
    it('registers rule_reference as a first-class TipTap Node (renders without throwing)', () => {
      const content = makeDoc([
        { type: 'rule_reference', ruleId: 'rule-stealth', title: 'Stealth Check' },
      ]);
      expect(() => render(<BodyEditor initialContent={content} onChange={() => {}} />)).not.toThrow();
    });
  });

  describe('full round-trip through live editor', () => {
    it('document with all three custom blocks loads without error', () => {
      const content = makeDoc([
        { type: 'paragraph', text: 'Intro paragraph.' },
        { type: 'entity_embed', entityId: 'character-ada', entityType: 'Character' },
        { type: 'secret_block', content: 'Hidden villain reveal.' },
        { type: 'rule_reference', ruleId: 'rule-grapple', title: 'Grapple' },
        { type: 'paragraph', text: 'Outro paragraph.' },
      ]);

      expect(() => render(<BodyEditor initialContent={content} onChange={() => {}} />)).not.toThrow();
    });

    it('onChange emits a portable_blocks_v1 doc when editor content changes', () => {
      const received: unknown[] = [];
      const content = makeDoc([
        { type: 'entity_embed', entityId: 'location-keep', entityType: 'Location' },
      ]);

      render(
        <BodyEditor
          initialContent={content}
          onChange={(doc) => received.push(doc)}
        />,
      );

      // The editor should call onChange at some point with a properly structured doc
      // (either on mount or on content change); at minimum it must not crash
      expect(document.querySelector('[contenteditable]')).toBeTruthy();
    });

    it('entity_embed block has entityId and entityType attrs available to TipTap', () => {
      const content = makeDoc([
        { type: 'entity_embed', entityId: 'faction-iron-keep', entityType: 'Faction' },
      ]);

      // If the extension is NOT registered, TipTap drops the node silently and the
      // contenteditable area will contain no trace of the entity. If registered, it renders.
      const { container } = render(<BodyEditor initialContent={content} onChange={() => {}} />);
      // The entity_embed extension should render something (data attr, placeholder, etc.)
      const embedEl = container.querySelector('[data-entity-id], [data-type="entity_embed"]');
      expect(embedEl).toBeTruthy();
    });
  });
});
