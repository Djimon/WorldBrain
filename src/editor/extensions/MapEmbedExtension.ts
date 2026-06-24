export const MapEmbedExtension = {
  name: 'map_embed' as const,
  config: {
    name: 'map_embed' as const,
    group: 'block',
    atom: true,
    addAttributes() {
      return { mapId: { default: null } };
    },
    renderHTML({ attrs }: { attrs: Record<string, unknown> }) {
      return ['div', { 'data-map-id': attrs.mapId ?? '', 'data-type': 'map_embed' }, 0];
    },
    addNodeView() {
      return null;
    },
  },
};

export default MapEmbedExtension;
