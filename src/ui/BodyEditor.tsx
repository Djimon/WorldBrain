import { Node, mergeAttributes } from '@tiptap/core';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { blocksToTipTap, tipTapToBlocks } from '../blocks/block-conversion';
import type { Block, PortableBlocksV1Doc } from '../blocks/block-registry';
import type { TipTapDoc } from '../blocks/block-conversion';

const EntityEmbedExtension = Node.create({
  name: 'entity_embed',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      entityId: { default: '' },
      entityType: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="entity_embed"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'entity_embed',
      'data-entity-id': HTMLAttributes.entityId,
      'data-entity-type': HTMLAttributes.entityType,
    })];
  },
});

const SecretBlockExtension = Node.create({
  name: 'secret_block',
  group: 'block',
  content: 'block+',
  addAttributes() {
    return {};
  },
  parseHTML() {
    return [{ tag: 'div[data-type="secret_block"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'secret_block', 'data-gm-only': 'true' }), 0];
  },
});

const RuleReferenceExtension = Node.create({
  name: 'rule_reference',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      ruleId: { default: '' },
      title: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-type="rule_reference"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'rule_reference',
      'data-rule-id': HTMLAttributes.ruleId,
    })];
  },
});

type BodyEditorProps = {
  initialBlocks?: PortableBlocksV1Doc;
  initialContent?: PortableBlocksV1Doc;
  onChange: (doc: PortableBlocksV1Doc) => void;
};

export function BodyEditor({ initialBlocks, initialContent, onChange }: BodyEditorProps) {
  const doc = initialContent ?? initialBlocks ?? { format: 'portable_blocks_v1' as const, blocks: [] };

  const editor = useEditor({
    extensions: [StarterKit, EntityEmbedExtension, SecretBlockExtension, RuleReferenceExtension],
    content: blocksToTipTap(doc.blocks as Block[]),
    onUpdate({ editor: ed }) {
      const json = ed.getJSON() as TipTapDoc;
      onChange({ format: 'portable_blocks_v1', blocks: tipTapToBlocks(json) });
    },
  });

  return (
    <div>
      <div role="toolbar" aria-label="Formatting">
        <button
          type="button"
          aria-label="Bold"
          aria-pressed={editor?.isActive('bold') ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >Bold</button>
        <button
          type="button"
          aria-label="Italic"
          aria-pressed={editor?.isActive('italic') ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >Italic</button>
        <button
          type="button"
          aria-label="H1"
          aria-pressed={editor?.isActive('heading', { level: 1 }) ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        >H1</button>
        <button
          type="button"
          aria-label="H2"
          aria-pressed={editor?.isActive('heading', { level: 2 }) ?? false}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        >H2</button>
        <button
          type="button"
          aria-label="List"
          aria-pressed={editor?.isActive('bulletList') ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        >List</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
