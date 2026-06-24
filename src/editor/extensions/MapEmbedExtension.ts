import { Node } from '@tiptap/core';

export const MapEmbedExtension = Node.create({
  name: 'map_embed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      mapId: { default: null },
    };
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', { 'data-map-id': HTMLAttributes.mapId ?? '', 'data-type': 'map_embed' }, 0];
  },

  addNodeView() {
    return null;
  },
});

export default MapEmbedExtension;
