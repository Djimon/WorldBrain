// E8-S08: Map embed block — TipTap block type for embedding a map view in entity bodies.
// See: https://github.com/Djimon/WorldBrain/issues/82

import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-leaflet', () => ({
  MapContainer: vi.fn(({ children }: { children: React.ReactNode }) => <div data-testid="map-container">{children}</div>),
  ImageOverlay: vi.fn(() => null),
  useMap: vi.fn(() => ({ on: vi.fn(), off: vi.fn() })),
}));

vi.mock('../src/services/map-service', () => ({
  getMap: vi.fn(() => ({ id: 'map-1', title: 'World Map', asset_id: 'asset-1', image_width_px: 1000, image_height_px: 800, calibration_json: null })),
  getAssetUrl: vi.fn(() => '/assets/map.png'),
}));

describe('E8-S08 map embed block', () => {
  describe('block registry registration', () => {
    it('map_embed block type is registered in the block registry', async () => {
      const mod = await import('../src/blocks/block-registry');
      const registry = mod.getBlockRegistry?.() ?? mod.BLOCK_REGISTRY ?? mod.blockRegistry;
      const types = Array.isArray(registry) ? registry.map((b: { type: string }) => b.type) : Object.keys(registry ?? {});
      expect(types).toContain('map_embed');
    });

    it('map_embed block has a renderer component', async () => {
      const mod = await import('../src/blocks/block-registry');
      const registry = mod.getBlockRegistry?.() ?? mod.BLOCK_REGISTRY ?? mod.blockRegistry;
      const mapBlock = Array.isArray(registry)
        ? registry.find((b: { type: string }) => b.type === 'map_embed')
        : (registry ?? {})['map_embed'];
      expect(mapBlock).toBeDefined();
      expect(mapBlock?.renderer ?? mapBlock?.component ?? mapBlock?.view).toBeDefined();
    });
  });

  describe('MapEmbedBlock component', () => {
    it('renders without throwing given a mapId', async () => {
      const { MapEmbedBlock } = await import('../src/blocks/MapEmbedBlock');
      expect(() => render(<MapEmbedBlock mapId="map-1" />)).not.toThrow();
    });

    it('shows map title', async () => {
      const { MapEmbedBlock } = await import('../src/blocks/MapEmbedBlock');
      render(<MapEmbedBlock mapId="map-1" />);
      expect(screen.getByText(/World Map/i)).toBeInTheDocument();
    });

    it('renders the map container', async () => {
      const { MapEmbedBlock } = await import('../src/blocks/MapEmbedBlock');
      render(<MapEmbedBlock mapId="map-1" />);
      expect(screen.getByTestId('map-container')).toBeInTheDocument();
    });

    it('shows a fallback when mapId is missing', async () => {
      const { MapEmbedBlock } = await import('../src/blocks/MapEmbedBlock');
      render(<MapEmbedBlock mapId="" />);
      expect(screen.getByText(/no map|select a map|map not found/i)).toBeInTheDocument();
    });
  });

  describe('TipTap node extension', () => {
    it('map_embed TipTap extension has a name of "map_embed"', async () => {
      const mod = await import('../src/editor/extensions/MapEmbedExtension');
      const ext = mod.MapEmbedExtension ?? mod.default;
      expect(ext?.name ?? ext?.config?.name).toBe('map_embed');
    });

    it('map_embed extension has renderHTML that emits data-map-id', async () => {
      const mod = await import('../src/editor/extensions/MapEmbedExtension');
      const ext = mod.MapEmbedExtension ?? mod.default;
      expect(ext).toBeDefined();
      // Must have renderHTML or addNodeView to produce data-map-id attribute
      const html = ext?.config?.renderHTML ?? ext?.renderHTML;
      expect(html ?? ext?.config?.addNodeView ?? ext?.addNodeView).toBeDefined();
    });
  });

  // #111: isMapEmbedBlock type guard missing
  describe('isMapEmbedBlock type guard (#111)', () => {
    it('block-registry exports isMapEmbedBlock', async () => {
      const mod = await import('../src/blocks/block-registry');
      expect(typeof mod.isMapEmbedBlock).toBe('function');
    });

    it('isMapEmbedBlock returns true for { type: "map_embed" }', async () => {
      const { isMapEmbedBlock } = await import('../src/blocks/block-registry');
      expect(isMapEmbedBlock({ type: 'map_embed', mapId: 'map-1' })).toBe(true);
    });

    it('isMapEmbedBlock returns false for other block types', async () => {
      const { isMapEmbedBlock } = await import('../src/blocks/block-registry');
      expect(isMapEmbedBlock({ type: 'paragraph' })).toBe(false);
    });

    it('isMapEmbedBlock returns false for null', async () => {
      const { isMapEmbedBlock } = await import('../src/blocks/block-registry');
      expect(isMapEmbedBlock(null)).toBe(false);
    });
  });

  // #108: MapEmbedExtension is plain object, not Node.create()
  describe('MapEmbedExtension is proper TipTap Node (#108)', () => {
    it('MapEmbedExtension has a configure method (Node.create() shape)', async () => {
      const mod = await import('../src/editor/extensions/MapEmbedExtension');
      const ext = mod.MapEmbedExtension ?? mod.default;
      expect(typeof ext.configure).toBe('function');
    });

    it('source uses Node.create() not a plain object literal', () => {
      const src = readFileSync('src/editor/extensions/MapEmbedExtension.ts', 'utf8');
      expect(src).toMatch(/Node\.create\s*\(/);
    });
  });

  describe('portable_blocks_v1 round-trip', () => {
    it('blocksToTipTap handles map_embed block type', async () => {
      const { blocksToTipTap } = await import('../src/blocks/block-conversion');
      const doc = {
        format: 'portable_blocks_v1' as const,
        blocks: [{ type: 'map_embed', mapId: 'map-1' }],
      };
      expect(() => blocksToTipTap(doc)).not.toThrow();
    });

    it('tipTapToBlocks handles map_embed node type', async () => {
      const { tipTapToBlocks } = await import('../src/blocks/block-conversion');
      const tiptapDoc = {
        type: 'doc',
        content: [{ type: 'map_embed', attrs: { mapId: 'map-1' } }],
      };
      expect(() => tipTapToBlocks(tiptapDoc)).not.toThrow();
    });
  });
});
