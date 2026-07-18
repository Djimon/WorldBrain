// #275/#276: adding image/fog layers must be purely additive — existing pins
// (map_markers) and grid settings (maps.grid_json) for the map must survive and
// the base image layer must remain, so the map still renders unchanged in the
// layer model. Also pins the service contracts (z_order = max+1, fog mask).
//
// node:sqlite in-memory DB with the real map schema. copyMapAsset is mocked
// (Tauri fs has no runtime in tests); everything else is the real service.

import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it, vi } from 'vitest';
import { applyMapSchema } from '../core_data/map-schema';
import type { DatabaseLike } from '../src/services/entity-service';

vi.mock('../src/services/map-asset', () => ({
  copyMapAsset: vi.fn(async () => '/proj/assets/maps/layer-x.png'),
}));

function makeAsyncDb(db: DatabaseSync): DatabaseLike {
  return {
    execute: (sql: string, args: unknown[] = []) => { db.prepare(sql).run(...args); return Promise.resolve(); },
    select: <T,>(sql: string, args: unknown[] = []): Promise<T[]> => Promise.resolve(db.prepare(sql).all(...args) as T[]),
  };
}

function createDatabase() {
  const raw = new DatabaseSync(':memory:');
  applyMapSchema(raw);
  // grid_json is a db-init ALTER, not part of applyMapSchema — add it here.
  raw.exec("ALTER TABLE maps ADD COLUMN grid_json TEXT");
  return { db: raw, asyncDb: makeAsyncDb(raw) };
}

describe('M15-S04 createFogLayer contract', () => {
  it('creates a fog layer with a non-empty mask at z_order = max(existing) + 1', async () => {
    const { db, asyncDb } = createDatabase();
    const { createLayer, createFogLayer, listLayers } = await import('../src/services/map-layer-service');
    try {
      await createLayer(asyncDb, { map_id: 'm1', layer_type: 'image' });
      const { id } = await createFogLayer(asyncDb, { map_id: 'm1' });
      const fog = (await listLayers(asyncDb, 'm1')).find((l) => l.id === id);
      expect(fog?.layer_type).toBe('fog');
      expect(fog?.mask_data).toBeTruthy();
      expect(fog?.z_order).toBe(1);
    } finally { db.close(); }
  });
});

describe('image layer offset persistence (movable image layers)', () => {
  it('updateLayer writes offset_x/offset_y; new layers default to 0/0', async () => {
    const { db, asyncDb } = createDatabase();
    const { createLayer, updateLayer, listLayers } = await import('../src/services/map-layer-service');
    try {
      const { id } = await createLayer(asyncDb, { map_id: 'm1', layer_type: 'image' });
      expect((await listLayers(asyncDb, 'm1'))[0].offset_x).toBe(0);
      await updateLayer(asyncDb, id, { offset_x: 320, offset_y: -40 });
      const layer = (await listLayers(asyncDb, 'm1')).find((l) => l.id === id);
      expect(layer?.offset_x).toBe(320);
      expect(layer?.offset_y).toBe(-40);
    } finally { db.close(); }
  });
});

describe('M15-S03 importImageLayer contract', () => {
  it('creates an image layer at z_order = max+1 with the copied asset path', async () => {
    const { db, asyncDb } = createDatabase();
    const { createLayer, importImageLayer, listLayers } = await import('../src/services/map-layer-service');
    try {
      await createLayer(asyncDb, { map_id: 'm1', layer_type: 'image' });
      const { id } = await importImageLayer(asyncDb, { map_id: 'm1', srcPath: '/tmp/x.png', projectDir: '/proj', name: 'Overlay' });
      const added = (await listLayers(asyncDb, 'm1')).find((l) => l.id === id);
      expect(added?.layer_type).toBe('image');
      expect(added?.name).toBe('Overlay');
      expect(added?.asset_id).toBe('/proj/assets/maps/layer-x.png');
      expect(added?.z_order).toBe(1);
    } finally { db.close(); }
  });
});

describe('adding layers preserves saved pins, grid settings, and the base image layer', () => {
  it('pins + grid_json survive and the original image layer stays after add image + add fog', async () => {
    const { db, asyncDb } = createDatabase();
    const { createLayer, importImageLayer, createFogLayer, listLayers } = await import('../src/services/map-layer-service');
    const { getMarkersForMap, createMarker } = await import('../src/services/map-marker-service');
    try {
      // Existing saved map: base image layer, a pin, and grid settings.
      await asyncDb.execute('INSERT INTO maps (id, title, image_width_px, image_height_px, grid_json) VALUES (?, ?, ?, ?, ?)',
        ['m1', 'Faerun', 1000, 800, '{"cellSize":50}']);
      await createLayer(asyncDb, { map_id: 'm1', layer_type: 'image', asset_id: '/proj/assets/maps/m1.png' });
      await createMarker(asyncDb, {
        map_id: 'm1', entity_id: null, kind: 'pin', geometry_json: '{"x":10,"y":20}',
        label_text: 'Start', elevation_value: null, elevation_unit: null,
        visibility_json: '"public"', style_json: '{}', group_name: '',
      });

      // Add layers.
      await importImageLayer(asyncDb, { map_id: 'm1', srcPath: '/tmp/x.png', projectDir: '/proj' });
      await createFogLayer(asyncDb, { map_id: 'm1' });

      // Pins survive untouched.
      const markers = await getMarkersForMap(asyncDb, 'm1');
      expect(markers.length).toBe(1);
      expect(markers[0].label_text).toBe('Start');

      // Grid settings survive untouched.
      const grid = await asyncDb.select<{ grid_json: string }>('SELECT grid_json FROM maps WHERE id = ?', ['m1']);
      expect(grid[0].grid_json).toBe('{"cellSize":50}');

      // Base image layer intact; two image layers + one fog layer now exist.
      const layers = await listLayers(asyncDb, 'm1');
      expect(layers.length).toBe(3);
      expect(layers.some((l) => l.asset_id === '/proj/assets/maps/m1.png')).toBe(true);
      expect(layers.filter((l) => l.layer_type === 'image').length).toBe(2);
      expect(layers.filter((l) => l.layer_type === 'fog').length).toBe(1);
    } finally { db.close(); }
  });
});
