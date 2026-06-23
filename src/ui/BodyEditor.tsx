import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { blocksToTipTap, tipTapToBlocks } from '../blocks/block-conversion';

type PortableDoc = { format: 'portable_blocks_v1'; blocks: Record<string, unknown>[] };

type BodyEditorProps = {
  initialBlocks: PortableDoc;
  onChange: (doc: PortableDoc) => void;
};

export function BodyEditor({ initialBlocks, onChange }: BodyEditorProps) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: blocksToTipTap(initialBlocks.blocks),
    onUpdate({ editor: ed }) {
      const json = ed.getJSON() as { type: 'doc'; content: { type: string; attrs?: Record<string, unknown>; content?: unknown[] }[] };
      onChange({ format: 'portable_blocks_v1', blocks: tipTapToBlocks(json) });
    },
  });

  return (
    <div>
      <div role="toolbar" aria-label="Formatting">
        <button type="button" aria-label="Bold" onClick={() => editor?.chain().focus().toggleBold().run()}>Bold</button>
        <button type="button" aria-label="Italic" onClick={() => editor?.chain().focus().toggleItalic().run()}>Italic</button>
        <button type="button" aria-label="H1" onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>H1</button>
        <button type="button" aria-label="H2" onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button type="button" aria-label="List" onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
